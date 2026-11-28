<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{

    public function run(): void
    {


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
                'position' => 'PGDH - PBO',
                'is_active' => true,
            ]
        );

        \App\Models\PpmpSignatory::firstOrCreate(
            ['signatory_type' => 'bac_secretariat'],
            [
                'name' => 'NORJANNA M. CAMAGUIN, MPA',
                'position' => 'PGDH - PPMO',
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

        $this->call(AccountCodeSeeder::class);
        $this->call(ProgramNameSeeder::class);
        $this->call(FundSourceSeeder::class);
    }
}
