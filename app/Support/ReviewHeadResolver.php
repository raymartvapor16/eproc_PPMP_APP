<?php

namespace App\Support;

use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpSignatory;
use App\Models\User;

class ReviewHeadResolver
{

    public static function resolveOfficeIdForStage(string $stage, ?Ppmp $ppmp = null, ?User $actingReviewer = null): ?int
    {
        if ($actingReviewer && $actingReviewer->office_id) {
            if (
                ($stage === 'budget' && $actingReviewer->hasAssignedRole('budget_officer')) ||
                ($stage === 'pacco' && $actingReviewer->hasAssignedRole('pacco')) ||
                ($stage === 'oppmo' && $actingReviewer->hasAssignedRole('oppmo'))
            ) {
                return (int) $actingReviewer->office_id;
            }
        }

        if ($ppmp) {
            if ($stage === 'budget' && $ppmp->budget_reviewer_id) {
                $reviewer = $ppmp->relationLoaded('budgetReviewer')
                    ? $ppmp->budgetReviewer
                    : User::find($ppmp->budget_reviewer_id);
                if ($reviewer && $reviewer->hasAssignedRole('budget_officer') && $reviewer->office_id) {
                    return (int) $reviewer->office_id;
                }
            }

            if ($stage === 'pacco' && $ppmp->budget_reviewer_id) {
                $reviewer = $ppmp->relationLoaded('budgetReviewer')
                    ? $ppmp->budgetReviewer
                    : User::find($ppmp->budget_reviewer_id);
                if ($reviewer && $reviewer->hasAssignedRole('pacco') && $reviewer->office_id) {
                    return (int) $reviewer->office_id;
                }
            }

            if ($stage === 'oppmo' && $ppmp->oppmo_reviewer_id) {
                $reviewer = $ppmp->relationLoaded('oppmoReviewer')
                    ? $ppmp->oppmoReviewer
                    : User::find($ppmp->oppmo_reviewer_id);
                if ($reviewer && $reviewer->hasAssignedRole('oppmo') && $reviewer->office_id) {
                    return (int) $reviewer->office_id;
                }
            }
        }

        $role = match ($stage) {
            'budget' => 'budget_officer',
            'pacco' => 'pacco',
            'oppmo' => 'oppmo',
            default => null,
        };

        if ($role) {
            $officeId = User::withRole($role)
                ->where('is_active', true)
                ->where('approval_status', 'approved')
                ->whereNotNull('office_id')
                ->value('office_id');
            if ($officeId) {
                return (int) $officeId;
            }

            $anyOfficeId = User::withRole($role)
                ->whereNotNull('office_id')
                ->value('office_id');
            if ($anyOfficeId) {
                return (int) $anyOfficeId;
            }
        }

        $officeCode = match ($stage) {
            'budget' => 'PBO',
            'pacco' => 'PACCO',
            'oppmo' => 'PMO',
            default => null,
        };

        if ($officeCode) {
            $officeId = Office::where('code', $officeCode)->value('id');
            return $officeId ? (int) $officeId : null;
        }

        return null;
    }

    public static function resolveHeadUserForStage(string $stage, ?Ppmp $ppmp = null, ?User $actingReviewer = null): ?User
    {
        if (in_array($stage, ['app_preparer', 'governor'], true)) {
            return self::resolveAppSignatoryUser($stage);
        }

        $officeId = self::resolveOfficeIdForStage($stage, $ppmp, $actingReviewer);
        if (!$officeId) {
            return null;
        }

        $headUser = User::with('pnpkiSignature')
            ->withRole('head')
            ->where('office_id', $officeId)
            ->orderByDesc('is_active')
            ->orderByRaw("CASE WHEN approval_status = 'approved' THEN 0 ELSE 1 END")
            ->orderByDesc('id')
            ->first();

        if ($headUser) {
            return $headUser;
        }

        $officeHeadId = Office::where('id', $officeId)->value('head_user_id');
        if ($officeHeadId) {
            return User::with('pnpkiSignature')->find($officeHeadId);
        }

        return null;
    }

    public static function resolveEndUserOfficeHead(Ppmp $ppmp): ?User
    {
        $officeId = $ppmp->office_id ?: $ppmp->creator?->office_id;
        if (!$officeId) {
            return null;
        }

        $headUser = User::with('pnpkiSignature')
            ->withRole('head')
            ->where('office_id', $officeId)
            ->orderByDesc('is_active')
            ->orderByRaw("CASE WHEN approval_status = 'approved' THEN 0 ELSE 1 END")
            ->orderByDesc('id')
            ->first();

        if ($headUser) {
            return $headUser;
        }

        $office = Office::find($officeId);
        if ($office && $office->head_user_id) {
            $byId = User::with('pnpkiSignature')->find($office->head_user_id);
            if ($byId) {
                return $byId;
            }
        }

        if ($office && !empty($office->head_name)) {
            return User::with('pnpkiSignature')
                ->whereRaw('UPPER(TRIM(name)) = ?', [strtoupper(trim((string) $office->head_name))])
                ->orderByDesc('is_active')
                ->orderByRaw("CASE WHEN approval_status = 'approved' THEN 0 ELSE 1 END")
                ->orderByDesc('id')
                ->first();
        }

        return null;
    }

    public static function resolveAppSignatoryUser(string $stage): ?User
    {
        $names = [];
        if ($stage === 'app_preparer') {
            $dbName = PpmpSignatory::where('signatory_type', 'app_prepared_by')
                ->where('is_active', true)
                ->value('name');
            if ($dbName) {
                $names[] = $dbName;
            }
            $names[] = 'GINA MAE B. CARBAQUEL';
        } elseif ($stage === 'governor') {
            $dbNames = PpmpSignatory::whereIn('signatory_type', ['app_approved_by', 'approved_by'])
                ->where('is_active', true)
                ->pluck('name')
                ->all();
            foreach ($dbNames as $n) {
                if ($n) {
                    $names[] = $n;
                }
            }
            $names[] = 'HON. YVONNE R. CAGAS';
        }

        $normalizedNames = array_values(array_unique(array_map(
            fn ($n) => strtoupper(trim((string) $n)),
            array_filter($names)
        )));

        if (empty($normalizedNames)) {
            return null;
        }

        $placeholders = implode(',', array_fill(0, count($normalizedNames), '?'));

        return User::with('pnpkiSignature')
            ->whereRaw("UPPER(TRIM(name)) IN ({$placeholders})", $normalizedNames)
            ->orderByDesc('is_active')
            ->orderByRaw("CASE WHEN approval_status = 'approved' THEN 0 ELSE 1 END")
            ->orderByDesc('id')
            ->first();
    }

    public static function requiresHeadEsignReview(?User $headUser): bool
    {
        if (!\App\Models\SystemSetting::isPnpkiEnabled()) {
            return false;
        }

        if (!$headUser || !$headUser->is_active || $headUser->approval_status !== 'approved') {
            return false;
        }

        $pnpki = $headUser->pnpkiSignature;
        if (!$pnpki) {
            return false;
        }

        return $pnpki->effective_signature_type === 'pnpki';
    }

    public static function resolveNextPostOppmoStep(Ppmp $ppmp, array $candidateStages, ?User $actingOppmoReviewer = null): ?array
    {
        foreach ($candidateStages as $stage) {
            $user = self::resolveHeadUserForStage($stage, $ppmp, $stage === 'oppmo' ? $actingOppmoReviewer : null);
            if (!self::requiresHeadEsignReview($user)) {
                continue;
            }

            $meta = match ($stage) {
                'budget' => ['status' => 'BUDGET_HEAD_REVIEW', 'role' => 'budget_head', 'label' => 'Budget Office Head'],
                'pacco' => ['status' => 'PACCO_HEAD_REVIEW', 'role' => 'pacco_head', 'label' => 'PACCO Head'],
                'oppmo' => ['status' => 'OPPMO_HEAD_REVIEW', 'role' => 'oppmo_head', 'label' => 'OPPMO Head'],
                'app_preparer' => ['status' => 'APP_PREPARER_REVIEW', 'role' => 'app_preparer', 'label' => 'APP Preparer'],
                'governor' => ['status' => 'GOVERNOR_REVIEW', 'role' => 'governor', 'label' => 'Provincial Governor'],
                default => null,
            };

            if ($meta) {
                return array_merge($meta, ['stage' => $stage, 'user' => $user]);
            }
        }

        return null;
    }

    public static function userStagesForHead(User $user): array
    {
        if (!$user->isHead() || !$user->office_id) {
            return [];
        }

        $stages = [];
        $officeReviewers = User::without('pnpkiSignature')
            ->where('office_id', $user->office_id)
            ->where(function ($q) {
                $q->whereIn('role', ['budget_officer', 'pacco', 'oppmo'])
                  ->orWhere('roles', 'like', '%budget_officer%')
                  ->orWhere('roles', 'like', '%pacco%')
                  ->orWhere('roles', 'like', '%oppmo%');
            })
            ->get(['role', 'roles']);

        foreach ($officeReviewers as $rev) {
            if ($rev->hasAssignedRole('budget_officer')) {
                $stages[] = 'budget';
            }
            if ($rev->hasAssignedRole('pacco')) {
                $stages[] = 'pacco';
            }
            if ($rev->hasAssignedRole('oppmo')) {
                $stages[] = 'oppmo';
            }
        }

        $officeCode = strtoupper(trim((string) ($user->relationLoaded('office') ? $user->office?->code : Office::where('id', $user->office_id)->value('code'))));
        if ($officeCode === 'PBO' && !in_array('budget', $stages, true)) {
            $stages[] = 'budget';
        } elseif ($officeCode === 'PACCO' && !in_array('pacco', $stages, true)) {
            $stages[] = 'pacco';
        } elseif ($officeCode === 'PMO' && !in_array('oppmo', $stages, true)) {
            $stages[] = 'oppmo';
        }

        return array_values(array_unique($stages));
    }

    public static function userAppSignatoryStages(User $user): array
    {
        $userName = strtoupper(trim((string) $user->name));
        if ($userName === '') {
            return [];
        }

        $activeSignatories = PpmpSignatory::getActiveSignatories();
        $preparerNames = ['GINA MAE B. CARBAQUEL'];
        $governorNames = ['HON. YVONNE R. CAGAS'];

        foreach ($activeSignatories as $sig) {
            $sigName = strtoupper(trim((string) ($sig->name ?? '')));
            if ($sigName === '') {
                continue;
            }
            if ($sig->signatory_type === 'app_prepared_by') {
                $preparerNames[] = $sigName;
            } elseif (in_array($sig->signatory_type, ['app_approved_by', 'approved_by'], true)) {
                $governorNames[] = $sigName;
            }
        }

        $stages = [];
        if (in_array($userName, $preparerNames, true)) {
            $stages[] = 'app_preparer';
        }
        if (in_array($userName, $governorNames, true)) {
            $stages[] = 'governor';
        }

        return $stages;
    }

    public static function stageForStatus(?string $status): ?string
    {
        return match ($status) {
            'BUDGET_HEAD_REVIEW', 'BUDGET_HEAD_RETURNED' => 'budget',
            'PACCO_HEAD_REVIEW', 'PACCO_HEAD_RETURNED' => 'pacco',
            'OPPMO_HEAD_REVIEW', 'OPPMO_HEAD_RETURNED' => 'oppmo',
            'APP_PREPARER_REVIEW', 'APP_PREPARER_RETURNED' => 'app_preparer',
            'GOVERNOR_REVIEW', 'GOVERNOR_RETURNED' => 'governor',
            default => null,
        };
    }
}
