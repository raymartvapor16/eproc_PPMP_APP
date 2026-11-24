<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{

    public function up(): void
    {

        DB::table('users')
            ->where('role', 'pacco')
            ->orWhere('email', 'pacco@system16.com')
            ->update([
                'name' => 'MAY FERNANDO-UY, CPA',
                'designation' => 'Provincial Accountant',
            ]);

        $existingPaccoSig = DB::table('ppmp_signatories')->where('signatory_type', 'pacco_requirement')->first();
        if ($existingPaccoSig) {
            DB::table('ppmp_signatories')->where('id', $existingPaccoSig->id)->update([
                'name' => 'MAY FERNANDO-UY, CPA',
                'position' => 'Provincial Accountant',
                'is_active' => true,
                'updated_at' => now(),
            ]);
        } else {
            DB::table('ppmp_signatories')->insert([
                'signatory_type' => 'pacco_requirement',
                'name' => 'MAY FERNANDO-UY, CPA',
                'position' => 'Provincial Accountant',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('ppmp_signatures')
            ->where('role', 'pacco')
            ->update([
                'signer_name' => 'MAY FERNANDO-UY, CPA',
                'signer_designation' => 'Provincial Accountant',
            ]);

        $oppmoUser = DB::table('users')->where('role', 'oppmo')->where('is_active', true)->first();
        $twgUser = DB::table('users')->where('role', 'twg')->where('is_active', true)->first();
        $budgetUser = DB::table('users')->where('role', 'budget_officer')->where('is_active', true)->first();
        $paccoUser = DB::table('users')->where('role', 'pacco')->where('is_active', true)->first();

        if ($oppmoUser) {
            DB::table('ppmp_routes')
                ->where('action', 'PACCO_RECEIVED')
                ->update([
                    'to_role' => 'oppmo',
                    'to_user_id' => $oppmoUser->id,
                ]);

            DB::table('ppmp_routes')
                ->where('action', 'BUDGET_RECEIVED')
                ->update([
                    'to_role' => 'oppmo',
                    'to_user_id' => $oppmoUser->id,
                ]);
        }

        if ($twgUser) {
            DB::table('ppmp_routes')
                ->where('action', 'OPPMO_RECEIVED')
                ->update([
                    'to_role' => 'twg',
                    'to_user_id' => $twgUser->id,
                ]);
        }

        $twgRoutes = DB::table('ppmp_routes')
            ->join('ppmps', 'ppmp_routes.ppmp_id', '=', 'ppmps.id')
            ->where('ppmp_routes.action', 'TWG_RECEIVED')
            ->select('ppmp_routes.id as route_id', 'ppmps.created_by')
            ->get();

        foreach ($twgRoutes as $r) {
            DB::table('ppmp_routes')
                ->where('id', $r->route_id)
                ->update([
                    'to_role' => 'end_user',
                    'to_user_id' => $r->created_by,
                ]);
        }
    }

    public function down(): void
    {

    }
};
