<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Create or update the Super Administrator account
        User::updateOrCreate(
            ['email' => 'admin@system16.com'],
            [
                'name'         => 'Super Administrator',
                'password'     => Hash::make('++admin@2026.davsur++'),
                'role'         => 'super_admin',
                'designation'  => 'Super Administrator',
                'is_active'    => true,
                'approval_status' => 'approved',
            ]
        );

        // Create or update the Administrator account
        User::updateOrCreate(
            ['email' => 'administrator@system16.com'],
            [
                'name'         => 'System Administrator',
                'password'     => Hash::make('++admin@2026.davsur++'),
                'role'         => 'admin',
                'designation'  => 'Provincial Administrator',
                'is_active'    => true,
                'approval_status' => 'approved',
            ]
        );

        // Create or update default PACCO Reviewer account
        User::updateOrCreate(
            ['email' => 'pacco@system16.com'],
            [
                'name'         => 'MAY FERNANDO-UY, CPA',
                'password'     => Hash::make('++admin@2026.davsur++'),
                'role'         => 'pacco',
                'designation'  => 'Provincial Accountant',
                'is_active'    => true,
                'approval_status' => 'approved',
            ]
        );

        // Create or update default OPPMO Monitoring Officer account
        User::updateOrCreate(
            ['email' => 'monitor@system16.com'],
            [
                'name'         => 'OPPMO Monitoring Officer',
                'password'     => Hash::make('++admin@2026.davsur++'),
                'role'         => 'monitor',
                'designation'  => 'Procurement Monitoring Officer',
                'is_active'    => true,
                'approval_status' => 'approved',
            ]
        );

        // Create or update default official PPMP signatories
        \App\Models\PpmpSignatory::updateOrCreate(
            ['signatory_type' => 'pacco_requirement'],
            [
                'name' => 'MAY FERNANDO-UY, CPA',
                'position' => 'Provincial Accountant',
                'is_active' => true,
            ]
        );

        \App\Models\PpmpSignatory::firstOrCreate(
            ['signatory_type' => 'budget_requirement'],
            [
                'name' => 'DESSAMIE BUAT-SANCHEZ, CPA, JD',
                'position' => 'PGDH - PBO / BAC - Chairman',
                'is_active' => true,
            ]
        );

        \App\Models\PpmpSignatory::firstOrCreate(
            ['signatory_type' => 'bac_secretariat'],
            [
                'name' => 'NORJANNA M. CAMAGUIN, MPA',
                'position' => 'PGDH - OPPMO',
                'is_active' => true,
            ]
        );

        \App\Models\PpmpSignatory::firstOrCreate(
            ['signatory_type' => 'approved_by'],
            [
                'name' => 'HON. YVONNE R. CAGAS',
                'position' => 'Provincial Governor',
                'is_active' => true,
            ]
        );

        // Official APP (Annual Procurement Plan) Signatories
        \App\Models\PpmpSignatory::updateOrCreate(
            ['signatory_type' => 'app_prepared_by'],
            [
                'name' => 'GINA MAE B. CARBAQUEL',
                'position' => 'ADAS II',
                'is_active' => true,
            ]
        );

        \App\Models\PpmpSignatory::firstOrCreate(
            ['signatory_type' => 'app_reviewed_by'],
            [
                'name' => 'NORJANNA M. CAMAGUIN, MPA',
                'position' => 'PGDH - OPPMO',
                'is_active' => true,
            ]
        );

        \App\Models\PpmpSignatory::firstOrCreate(
            ['signatory_type' => 'app_recommending'],
            [
                'name' => 'DESSAMIE BUAT-SANCHEZ, CPA, JD',
                'position' => 'PGDH - PBO / BAC - Chairman',
                'is_active' => true,
            ]
        );

        \App\Models\PpmpSignatory::firstOrCreate(
            ['signatory_type' => 'app_approved_by'],
            [
                'name' => 'HON. YVONNE R. CAGAS',
                'position' => 'Provincial Governor',
                'is_active' => true,
            ]
        );
    }
}
