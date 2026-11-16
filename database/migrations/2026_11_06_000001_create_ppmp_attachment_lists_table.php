<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('ppmp_attachment_lists', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('ppmp_id')->constrained('ppmps')->cascadeOnDelete();
            $table->foreignId('item_id')->nullable()->constrained('ppmp_items')->nullOnDelete();
            $table->integer('item_no')->nullable();
            $table->string('project_title')->nullable();
            $table->string('office_name')->nullable();
            $table->decimal('total_budget', 18, 2)->default(0.00);
            $table->text('charges')->nullable();
            $table->string('place_of_delivery')->nullable();
            $table->string('payment_method')->nullable();
            $table->string('delivery_period')->nullable();
            $table->string('additional_condition')->nullable();
            $table->text('other_terms')->nullable();
            $table->json('rows')->nullable();
            $table->string('prepared_by_name')->nullable();
            $table->string('prepared_by_position')->nullable();
            $table->string('submitted_by_name')->nullable();
            $table->string('submitted_by_position')->nullable();
            $table->string('approved_by_name')->nullable();
            $table->string('approved_by_position')->nullable();
            $table->boolean('is_approved')->default(false);
            $table->timestamps();

            $table->index('ppmp_id');
            $table->index('item_id');
        });

        // Migrate existing attachment_list_data from ppmps into ppmp_attachment_lists
        $existingPpmps = DB::table('ppmps')->whereNotNull('attachment_list_data')->get(['id', 'attachment_list_data', 'created_at', 'updated_at']);

        foreach ($existingPpmps as $ppmp) {
            $data = json_decode($ppmp->attachment_list_data, true);
            if (!is_array($data)) {
                continue;
            }

            $attachmentLists = $data['attachment_lists'] ?? [];
            if (!empty($attachmentLists) && is_array($attachmentLists)) {
                foreach ($attachmentLists as $key => $list) {
                    $itemId = is_numeric($key) ? (int)$key : null;
                    DB::table('ppmp_attachment_lists')->insert([
                        'uuid' => (string) Str::uuid(),
                        'ppmp_id' => $ppmp->id,
                        'item_id' => $itemId,
                        'item_no' => $list['itemNo'] ?? null,
                        'project_title' => $list['project_title'] ?? ($data['project_title'] ?? null),
                        'office_name' => $list['office_name'] ?? ($data['office_name'] ?? null),
                        'total_budget' => isset($list['total_budget']) && is_numeric($list['total_budget']) ? (float)$list['total_budget'] : (float)($data['total_budget'] ?? 0),
                        'charges' => $list['charges'] ?? ($data['charges'] ?? null),
                        'place_of_delivery' => $list['place_of_delivery'] ?? ($data['place_of_delivery'] ?? null),
                        'payment_method' => $list['payment_method'] ?? ($data['payment_method'] ?? null),
                        'delivery_period' => $list['delivery_period'] ?? ($data['delivery_period'] ?? null),
                        'additional_condition' => $list['additional_condition'] ?? ($data['additional_condition'] ?? null),
                        'other_terms' => $list['other_terms'] ?? ($data['other_terms'] ?? null),
                        'rows' => isset($list['rows']) ? json_encode($list['rows']) : null,
                        'prepared_by_name' => $data['prepared_by_name'] ?? null,
                        'prepared_by_position' => $data['prepared_by_position'] ?? null,
                        'submitted_by_name' => $data['submitted_by_name'] ?? null,
                        'submitted_by_position' => $data['submitted_by_position'] ?? null,
                        'approved_by_name' => $data['approved_by_name'] ?? null,
                        'approved_by_position' => $data['approved_by_position'] ?? null,
                        'is_approved' => !empty($data['approved_by_name']),
                        'created_at' => $ppmp->created_at ?? now(),
                        'updated_at' => $ppmp->updated_at ?? now(),
                    ]);
                }
            } elseif (!empty($data['rows'])) {
                DB::table('ppmp_attachment_lists')->insert([
                    'uuid' => (string) Str::uuid(),
                    'ppmp_id' => $ppmp->id,
                    'item_id' => $data['active_item_id'] ?? null,
                    'item_no' => 1,
                    'project_title' => $data['project_title'] ?? null,
                    'office_name' => $data['office_name'] ?? null,
                    'total_budget' => isset($data['total_budget']) && is_numeric($data['total_budget']) ? (float)$data['total_budget'] : 0,
                    'charges' => $data['charges'] ?? null,
                    'place_of_delivery' => $data['place_of_delivery'] ?? null,
                    'payment_method' => $data['payment_method'] ?? null,
                    'delivery_period' => $data['delivery_period'] ?? null,
                    'additional_condition' => $data['additional_condition'] ?? null,
                    'other_terms' => $data['other_terms'] ?? null,
                    'rows' => json_encode($data['rows']),
                    'prepared_by_name' => $data['prepared_by_name'] ?? null,
                    'prepared_by_position' => $data['prepared_by_position'] ?? null,
                    'submitted_by_name' => $data['submitted_by_name'] ?? null,
                    'submitted_by_position' => $data['submitted_by_position'] ?? null,
                    'approved_by_name' => $data['approved_by_name'] ?? null,
                    'approved_by_position' => $data['approved_by_position'] ?? null,
                    'is_approved' => !empty($data['approved_by_name']),
                    'created_at' => $ppmp->created_at ?? now(),
                    'updated_at' => $ppmp->updated_at ?? now(),
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ppmp_attachment_lists');
    }
};

