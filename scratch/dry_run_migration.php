<?php

require 'c:/Users/pmoch/OneDrive/Desktop/system/Ongoing Finalize system/eproc/vendor/autoload.php';
$app = require_once 'c:/Users/pmoch/OneDrive/Desktop/system/Ongoing Finalize system/eproc/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

echo "=== DRY RUN MIGRATION ===\n";

DB::beginTransaction();

try {
    // 1. Prepare offices table: drop unique constraint on code, add regular index
    echo "1. Checking offices table indices...\n";
    $indices = DB::select("SHOW INDEX FROM offices WHERE Key_name = 'offices_code_unique'");
    if (!empty($indices)) {
        echo "Dropping unique index offices_code_unique...\n";
        DB::statement("ALTER TABLE offices DROP INDEX offices_code_unique");
        DB::statement("ALTER TABLE offices ADD INDEX offices_code_index (code)");
    }

    // 2. Prepare users table: ensure role ENUM includes pgso, administrator, presentative_staff
    echo "2. Ensuring users.role ENUM includes all roles...\n";
    DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('end_user', 'head', 'budget_officer', 'oppmo', 'twg', 'super_admin', 'admin', 'administrator', 'authorized_staff', 'presentative_staff', 'pacco', 'monitor', 'pgso') DEFAULT 'end_user'");

    // 3. Migrate supplier_offices -> offices
    echo "3. Migrating supplier_offices to offices...\n";
    $supplierOffices = DB::table('supplier_offices')->orderBy('id')->get();
    $insertedOffices = 0;
    foreach ($supplierOffices as $so) {
        $exists = DB::table('offices')->where('id', $so->id)->exists();
        if (!$exists) {
            DB::table('offices')->insert([
                'id' => $so->id,
                'name' => trim($so->name ?: 'NA'),
                'code' => trim($so->abbreviation ?: 'NA'),
                'head_name' => $so->head,
                'designation' => $so->designation,
                'responsibility_number' => $so->responsibility_number,
                'created_at' => $so->created_at ?: now(),
                'updated_at' => $so->updated_at ?: now(),
            ]);
            $insertedOffices++;
        }
    }
    echo "Successfully inserted {$insertedOffices} offices into offices table.\n";
    echo "Offices total count in DB: " . DB::table('offices')->count() . "\n";

    // 4. Migrate supplier_users -> users avoiding duplicate emails
    echo "4. Migrating supplier_users to users...\n";
    $existingUsers = DB::table('users')->get()->keyBy(fn($u) => strtolower(trim($u->email)));
    $existingUserIds = DB::table('users')->pluck('id')->toArray();

    $supplierUsers = DB::table('supplier_users')->orderBy('id')->get();
    $userIdMap = []; // old_supplier_user_id => new_user_id
    $updatedCount = 0;
    $insertedCount = 0;

    foreach ($supplierUsers as $su) {
        $cleanEmail = strtolower(trim($su->email));

        if ($existingUsers->has($cleanEmail)) {
            // AVOID DUPLICATE EMAIL: Update existing user record with supplier details
            $existing = $existingUsers->get($cleanEmail);
            $userIdMap[$su->id] = $existing->id;

            $existingSystems = is_string($existing->accessible_systems)
                ? (json_decode($existing->accessible_systems, true) ?: [])
                : ($existing->accessible_systems ?: []);

            if (!in_array('/supplierevaluation', $existingSystems, true)) {
                $existingSystems[] = '/supplierevaluation';
            }

            DB::table('users')->where('id', $existing->id)->update([
                'office_id' => $existing->office_id ?: ($su->office_id ?: null),
                'designation' => $existing->designation ?: $su->designation,
                'signature_path' => $existing->signature_path ?: $su->signature,
                'authorization_letter_path' => $existing->authorization_letter_path ?: $su->authorization_letter,
                'accessible_systems' => json_encode(array_values(array_unique($existingSystems))),
                'updated_at' => now(),
            ]);

            $updatedCount++;
            echo "Matched duplicate email: {$su->email} -> updated existing user ID {$existing->id}\n";
        } else {
            // NEW USER: Insert into users table
            $role = $su->role;
            if ($role === 'administrator') $role = 'admin';
            elseif ($role === 'presentative_staff') $role = 'authorized_staff';

            $isActive = strtolower($su->status ?? '') === 'active';
            $systems = ['/supplierevaluation'];

            $insertData = [
                'name' => $su->name,
                'email' => $su->email,
                'password' => $su->password,
                'role' => $role,
                'designation' => $su->designation,
                'signature_path' => $su->signature,
                'authorization_letter_path' => $su->authorization_letter,
                'office_id' => $su->office_id ?: null,
                'is_active' => $isActive ? 1 : 0,
                'approval_status' => $isActive ? 'approved' : 'pending',
                'accessible_systems' => json_encode($systems),
                'email_verified_at' => $su->email_verified_at ?: ($isActive ? now() : null),
                'created_at' => $su->created_at ?: now(),
                'updated_at' => $su->updated_at ?: now(),
            ];

            // If ID is not in existingUserIds, preserve original ID!
            if (!in_array($su->id, $existingUserIds)) {
                $insertData['id'] = $su->id;
                DB::table('users')->insert($insertData);
                $userIdMap[$su->id] = $su->id;
                $existingUserIds[] = $su->id;
            } else {
                // ID already taken in users table (e.g. ID 1), auto-assign next ID
                $newId = DB::table('users')->insertGetId($insertData);
                $userIdMap[$su->id] = $newId;
                $existingUserIds[] = $newId;
            }

            $insertedCount++;
        }
    }

    echo "Inserted {$insertedCount} new users. Updated {$updatedCount} existing users with same email.\n";
    echo "Users total count in DB: " . DB::table('users')->count() . "\n";
    echo "Old -> New user ID map: " . json_encode($userIdMap) . "\n";

    // 5. Update foreign key user_id references in supplier tables where mapped
    foreach ($userIdMap as $oldId => $newId) {
        if ($oldId !== $newId) {
            echo "Updating references from old user ID {$oldId} to new user ID {$newId}...\n";
            DB::table('supplier_digital_approvals')->where('signed_by', $oldId)->update(['signed_by' => $newId]);
            DB::table('supplier_activity_logs')->where('user_id', $oldId)->update(['user_id' => $newId]);
            DB::table('supplier_requests')->where('user_id', $oldId)->update(['user_id' => $newId]);
            DB::table('supplier_requests')->where('requested_to', $oldId)->update(['requested_to' => $newId]);
            DB::table('supplier_pdfs')->where('user_id', $oldId)->update(['user_id' => $newId]);
            DB::table('supplier_authorizes')->where('user_id', $oldId)->update(['user_id' => $newId]);
        }
    }

    // 6. Verify relations
    echo "Verifying supplier_evaluations office relationship:\n";
    $evalWithOffice = DB::table('supplier_evaluations')
        ->join('offices', 'supplier_evaluations.office_id', '=', 'offices.id')
        ->count();
    $totalEvals = DB::table('supplier_evaluations')->count();
    echo "Evaluations joined with offices: {$evalWithOffice} / {$totalEvals}\n";

    echo "Verifying supplier_digital_approvals signer relationship:\n";
    $approvalsWithUser = DB::table('supplier_digital_approvals')
        ->join('users', 'supplier_digital_approvals.signed_by', '=', 'users.id')
        ->count();
    $totalApprovals = DB::table('supplier_digital_approvals')->count();
    echo "Approvals joined with users: {$approvalsWithUser} / {$totalApprovals}\n";

    echo "\nDRY RUN SUCCESSFUL! Rolling back transaction.\n";
    DB::rollBack();
} catch (\Throwable $e) {
    DB::rollBack();
    echo "ERROR in dry run: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n";
}

