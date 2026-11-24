 <?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::create('account_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->nullable()->index();
            $table->string('name', 255)->index();
            $table->string('sub_code', 50)->nullable();
            $table->string('parent_name', 255)->nullable();
            $table->string('account_class', 50)->nullable()->index();
            $table->text('full_description')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->integer('display_order')->default(0);
            $table->timestamps();

            $table->unique(['code', 'name'], 'account_codes_code_name_unique');
        });

        Schema::table('ppmps', function (Blueprint $table) {
            $table->foreignId('account_code_id')
                ->nullable()
                ->after('account_code')
                ->constrained('account_codes')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('ppmps', function (Blueprint $table) {
            $table->dropForeign(['account_code_id']);
            $table->dropColumn('account_code_id');
        });

        Schema::dropIfExists('account_codes');
    }
};
