<?php

namespace Database\Seeders;

use App\Models\Ppmp;
use App\Models\ProgramName;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ProgramNameSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $csvPath = __DIR__ . '/program_names.csv';
        if (!file_exists($csvPath)) {
            $this->command?->error("CSV file not found: {$csvPath}");
            return;
        }

        $handle = fopen($csvPath, 'r');
        if ($handle === false) {
            $this->command?->error("Failed to open CSV file: {$csvPath}");
            return;
        }

        // Skip header
        $header = fgetcsv($handle);
        $records = [];
        $seen = [];
        $now = now();
        $importedCount = 0;

        while (($row = fgetcsv($handle)) !== false) {
            if (empty($row) || !isset($row[0])) {
                continue;
            }

            $name = trim($row[0]);
            if (empty($name)) {
                continue;
            }

            $respCenter = isset($row[1]) && trim($row[1]) !== '' ? trim($row[1]) : null;
            $sector = isset($row[2]) && trim($row[2]) !== '' ? trim($row[2]) : 'I. GENERAL PUBLIC SERVICES';
            $displayOrder = isset($row[3]) ? (int) $row[3] : 0;

            // Unique deduplication key
            $key = mb_strtoupper($name) . '|' . ($respCenter ?? '');
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;

            $records[] = [
                'name' => $name,
                'responsibility_center' => $respCenter,
                'sector' => $sector,
                'is_active' => true,
                'display_order' => $displayOrder,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        fclose($handle);

        // Chunk insert in batches of 100
        foreach (array_chunk($records, 100) as $chunk) {
            ProgramName::upsert(
                $chunk,
                ['name', 'responsibility_center'],
                ['sector', 'is_active', 'display_order', 'updated_at']
            );
            $importedCount += count($chunk);
        }

        $this->command?->info("ProgramNameSeeder: Seeded {$importedCount} program names successfully.");

        // Automatically link existing PPMP records where program_name matches
        $this->linkExistingPpmps();
    }

    /**
     * Link existing PPMPs to newly seeded ProgramName records.
     */
    private function linkExistingPpmps(): void
    {
        $ppmps = Ppmp::whereNotNull('program_name')
            ->whereNull('program_name_id')
            ->get();

        $linkedCount = 0;
        foreach ($ppmps as $ppmp) {
            $cleaned = trim($ppmp->program_name);
            if (empty($cleaned)) {
                continue;
            }

            $program = ProgramName::where('name', $cleaned)->first()
                ?? ProgramName::where('name', 'LIKE', '%' . $cleaned . '%')->first();

            if ($program) {
                $ppmp->update(['program_name_id' => $program->id]);
                $linkedCount++;
            }
        }

        if ($linkedCount > 0) {
            $this->command?->info("ProgramNameSeeder: Auto-linked {$linkedCount} existing PPMPs to program names.");
        }
    }
}

