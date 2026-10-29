<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        $isMysql = in_array($driver, ['mysql', 'mariadb'], true);

        // 1. Drop foreign keys on supplier tables that reference supplier_users or supplier_offices
        if ($isMysql) {
            $oldFKs = [
                ['supplier_evaluations', 'supplier_evaluations_office_id_foreign'],
                ['supplier_digital_approvals', 'supplier_digital_approvals_signed_by_foreign'],
                ['supplier_activity_logs', 'supplier_activity_logs_user_id_foreign'],
                ['supplier_authorizes', 'supplier_authorizes_office_id_foreign'],
                ['supplier_authorizes', 'supplier_authorizes_user_id_foreign'],
                ['supplier_pdfs', 'supplier_pdfs_user_id_foreign'],
                ['supplier_requests', 'supplier_requests_user_id_foreign'],
                ['supplier_requests', 'supplier_requests_requested_to_foreign'],
                ['supplier_users', 'supplier_users_office_id_foreign'],
            ];

            foreach ($oldFKs as [$tbl, $fk]) {
                if (Schema::hasTable($tbl)) {
                    try {
                        DB::statement("ALTER TABLE `{$tbl}` DROP FOREIGN KEY `{$fk}`");
                    } catch (\Throwable $e) {
                        // Ignored if foreign key doesn't exist
                    }
                }
            }

            // 2. Drop unique constraint on offices.code to allow sub-divisions/offices sharing codes
            if (Schema::hasTable('offices')) {
                $indices = DB::select("SHOW INDEX FROM offices WHERE Key_name = 'offices_code_unique'");
                if (!empty($indices)) {
                    DB::statement("ALTER TABLE offices DROP INDEX offices_code_unique");
                    DB::statement("ALTER TABLE offices ADD INDEX offices_code_index (code)");
                }
            }

            // 3. Ensure users.role ENUM includes all procurement and evaluation roles
            if (Schema::hasTable('users')) {
                DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('end_user', 'head', 'budget_officer', 'oppmo', 'twg', 'super_admin', 'admin', 'administrator', 'authorized_staff', 'presentative_staff', 'pacco', 'monitor', 'pgso') DEFAULT 'end_user'");
            }
        }

        // 4. Migrate supplier_offices -> offices table
        if (Schema::hasTable('supplier_offices') && Schema::hasTable('offices')) {
            $supplierOffices = DB::table('supplier_offices')->orderBy('id')->get();
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
                } else {
                    DB::table('offices')->where('id', $so->id)->update([
                        'name' => trim($so->name ?: 'NA'),
                        'code' => trim($so->abbreviation ?: 'NA'),
                        'head_name' => $so->head,
                        'designation' => $so->designation,
                        'responsibility_number' => $so->responsibility_number,
                        'updated_at' => $so->updated_at ?: now(),
                    ]);
                }
            }
        }

        // 5. Migrate supplier_users -> users table (AVOIDING DUPLICATES WITH SAME EMAIL)
        if (Schema::hasTable('supplier_users') && Schema::hasTable('users')) {
            $existingUsers = DB::table('users')->get()->keyBy(fn ($u) => strtolower(trim($u->email)));
            $existingUserIds = DB::table('users')->pluck('id')->toArray();

            $supplierUsers = DB::table('supplier_users')->orderBy('id')->get();
            $userIdMap = []; // old_supplier_user_id => new_users_table_id

            foreach ($supplierUsers as $su) {
                $cleanEmail = strtolower(trim($su->email));

                if ($existingUsers->has($cleanEmail)) {
                    // Avoid duplicate user with same email: enrich existing user
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
                } else {
                    // New user: insert into users table
                    $role = $su->role;
                    if ($role === 'administrator') {
                        $role = 'admin';
                    } elseif ($role === 'presentative_staff') {
                        $role = 'authorized_staff';
                    }

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

                    if (!in_array($su->id, $existingUserIds, true)) {
                        $insertData['id'] = $su->id;
                        DB::table('users')->insert($insertData);
                        $userIdMap[$su->id] = $su->id;
                        $existingUserIds[] = $su->id;
                    } else {
                        $newId = DB::table('users')->insertGetId($insertData);
                        $userIdMap[$su->id] = $newId;
                        $existingUserIds[] = $newId;
                    }
                }
            }

            // 6. Update user foreign key references in supplier tables to match new user IDs
            foreach ($userIdMap as $oldId => $newId) {
                if ($oldId !== $newId) {
                    if (Schema::hasTable('supplier_digital_approvals')) {
                        DB::table('supplier_digital_approvals')->where('signed_by', $oldId)->update(['signed_by' => $newId]);
                    }
                    if (Schema::hasTable('supplier_activity_logs')) {
                        DB::table('supplier_activity_logs')->where('user_id', $oldId)->update(['user_id' => $newId]);
                    }
                    if (Schema::hasTable('supplier_requests')) {
                        DB::table('supplier_requests')->where('user_id', $oldId)->update(['user_id' => $newId]);
                        DB::table('supplier_requests')->where('requested_to', $oldId)->update(['requested_to' => $newId]);
                    }
                    if (Schema::hasTable('supplier_pdfs')) {
                        DB::table('supplier_pdfs')->where('user_id', $oldId)->update(['user_id' => $newId]);
                    }
                    if (Schema::hasTable('supplier_authorizes')) {
                        DB::table('supplier_authorizes')->where('user_id', $oldId)->update(['user_id' => $newId]);
                    }
                }
            }
        }

        // 7. Add foreign key constraints pointing to unified offices and users tables
        if ($isMysql) {
            try {
                if (Schema::hasTable('supplier_evaluations')) {
                    DB::statement("ALTER TABLE supplier_evaluations ADD CONSTRAINT supplier_evaluations_office_id_foreign FOREIGN KEY (office_id) REFERENCES offices (id) ON DELETE CASCADE");
                }
                if (Schema::hasTable('supplier_digital_approvals')) {
                    DB::statement("ALTER TABLE supplier_digital_approvals ADD CONSTRAINT supplier_digital_approvals_signed_by_foreign FOREIGN KEY (signed_by) REFERENCES users (id) ON DELETE CASCADE");
                }
                if (Schema::hasTable('supplier_activity_logs')) {
                    DB::statement("ALTER TABLE supplier_activity_logs ADD CONSTRAINT supplier_activity_logs_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE");
                }
                if (Schema::hasTable('supplier_authorizes')) {
                    DB::statement("ALTER TABLE supplier_authorizes ADD CONSTRAINT supplier_authorizes_office_id_foreign FOREIGN KEY (office_id) REFERENCES offices (id) ON DELETE CASCADE");
                    DB::statement("ALTER TABLE supplier_authorizes ADD CONSTRAINT supplier_authorizes_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE");
                }
                if (Schema::hasTable('supplier_pdfs')) {
                    DB::statement("ALTER TABLE supplier_pdfs ADD CONSTRAINT supplier_pdfs_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE");
                }
                if (Schema::hasTable('supplier_requests')) {
                    DB::statement("ALTER TABLE supplier_requests ADD CONSTRAINT supplier_requests_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE");
                    DB::statement("ALTER TABLE supplier_requests ADD CONSTRAINT supplier_requests_requested_to_foreign FOREIGN KEY (requested_to) REFERENCES users (id) ON DELETE SET NULL");
                }
            } catch (\Throwable $e) {
                // If any foreign key already exists or cannot be created, log/continue
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Non-destructive down method
    }
};

