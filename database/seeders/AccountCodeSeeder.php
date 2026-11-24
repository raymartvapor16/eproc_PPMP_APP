<?php

namespace Database\Seeders;

use App\Models\AccountCode;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AccountCodeSeeder extends Seeder
{

    public function run(): void
    {
        $csvPath = database_path('seeders/chart_of_accounts.csv');
        if (!file_exists($csvPath)) {
            $this->command->warn("Chart of Accounts CSV not found at: {$csvPath}");
            return;
        }

        $handle = fopen($csvPath, 'r');
        if (!$handle) {
            $this->command->error("Unable to open CSV: {$csvPath}");
            return;
        }

        $records = [];
        $seen = [];
        $currentMain = null;
        $order = 0;

        while (($csv = fgetcsv($handle, 4096, ',')) !== false) {
            if (count($csv) < 3) {
                continue;
            }

            $code = trim($csv[1] ?? '');
            $name = trim($csv[2] ?? '');

            if (empty($code) && empty($name)) {
                continue;
            }
            if (in_array($name, [
                'Republic of the Philippines',
                'PROVINCE OF DAVAO DEL SUR',
                'OFFICE OF THE MUNICIPAL ACCOUNTANT',
                'CHART OF ACCOUNTS'
            ], true) || in_array($code, ['Republic of the Philippines', 'PROVINCE OF DAVAO DEL SUR'], true)) {
                continue;
            }

            $name = preg_replace('/\s+/', ' ', $name);

            $isStandardCode = (bool) preg_match('/^[0-9]-[0-9]{2}-[0-9]{2}-[0-9]{3}$/', $code);

            $recordCode = $code ?: null;
            $subCode = null;
            $parentName = null;

            if ($isStandardCode) {
                $currentMain = ['code' => $code, 'name' => $name];
                $recordCode = $code;
            } elseif (empty($code) && $currentMain) {

                $recordCode = $currentMain['code'];
                $parentName = $currentMain['name'];

                if (preg_match('/^-\s*([0-9a-zA-Z.]+)\s*-\s*(.+)$/', $name, $matches)) {
                    $subCode = trim($matches[1]);
                }
            } elseif (empty($code)) {

                if (preg_match('/^-\s*-\s*(.+)$/', $name, $m)) {
                    $name = trim($m[1]);
                }
            }

            $accountClass = AccountCode::deriveAccountClass($recordCode);

            if ($recordCode && $parentName && $parentName !== $name) {
                $fullDesc = "{$recordCode} • {$parentName} ({$name})";
            } elseif ($recordCode) {
                $fullDesc = "{$recordCode} • {$name}";
            } else {
                $fullDesc = $name;
            }

            $key = strtolower(($recordCode ?: '') . '|' . $name);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;

            $order++;
            $records[] = [
                'code' => $recordCode,
                'name' => $name,
                'sub_code' => $subCode,
                'parent_name' => $parentName,
                'account_class' => $accountClass,
                'full_description' => $fullDesc,
                'is_active' => true,
                'display_order' => $order,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        fclose($handle);

        $chunks = array_chunk($records, 100);
        foreach ($chunks as $chunk) {
            DB::table('account_codes')->upsert(
                $chunk,
                ['code', 'name'],
                ['sub_code', 'parent_name', 'account_class', 'full_description', 'is_active', 'display_order', 'updated_at']
            );
        }

        $ppmps = \App\Models\Ppmp::whereNull('account_code_id')->whereNotNull('account_code')->get();
        $linkedCount = 0;
        foreach ($ppmps as $p) {
            if (preg_match('/[0-9]-[0-9]{2}-[0-9]{2}-[0-9]{3}/', $p->account_code, $matches)) {
                $matched = AccountCode::where('code', $matches[0])->first();
                if ($matched) {
                    $p->update(['account_code_id' => $matched->id]);
                    $linkedCount++;
                }
            }
        }

        $totalInserted = AccountCode::count();
        if (isset($this->command)) {
            $this->command->info("Successfully seeded Chart of Accounts: {$totalInserted} unique records imported. Linked {$linkedCount} existing PPMPs.");
        }
    }
}
