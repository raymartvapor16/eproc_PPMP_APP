<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::create('other_terms', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('category')->default('CSE');
            $table->text('description');
            $table->boolean('is_active')->default(true);
            $table->integer('display_order')->default(0);
            $table->timestamps();
        });

        $now = Carbon::now();

        DB::table('other_terms')->insertOrIgnore([

            [
                'name' => 'Green Spec: Multi-Copy Paper & Record Books',
                'category' => 'CSE',
                'description' => "- Can be recycled/can be re-used\n- preferably made of recycled materials, if not, it must be sourced-out from a well-managed tree plantation\n- Preferably at least Elemental Chlorine Free (ECF)\n- Packaging must be recyclable",
                'is_active' => true,
                'display_order' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: Plastic Chairs',
                'category' => 'CSE',
                'description' => "- Preferably products made of plastic materials which do not contain toxic chemicals such as, but not limited to, lead, chromium, cadmium, mercury, phthalates, and halogenated organic substance.\n- The chairs shall be marked for recycling according to any ISO certifications or Philippine Standards or equivalent laws, rules and regulations",
                'is_active' => true,
                'display_order' => 2,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: Plastic Trash Bags',
                'category' => 'CSE',
                'description' => "- Preferably made of recycled materials\n- packaging must be recyclable",
                'is_active' => true,
                'display_order' => 3,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: Detergent Powder',
                'category' => 'CSE',
                'description' => "- Non-use of biohazard chemicals such as, but not limited to, ethylenediamine-tetra-acetate (EDTA) nor alkyl phenol ethoxylates (APEO)\n- Recyclable packaging materials",
                'is_active' => true,
                'display_order' => 4,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: Toilet Paper',
                'category' => 'CSE',
                'description' => "- Preferably use of biodegradable raw materials\n- preferably made of recycled materials, if not, it must be sourced-out from a well-managed tree plantation\n- preferably at least Elemental Chlorine Free (ECF)",
                'is_active' => true,
                'display_order' => 5,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: Cleaners',
                'category' => 'CSE',
                'description' => "- Not chlorine based and does not contain inorganic acids such as, but not limited to, hydrochloric acid, nitric acid, sulphuric acid, phosphoric acid\n- Containers can be re-used/recycled",
                'is_active' => true,
                'display_order' => 6,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: Disinfectant Sprays & Liquid Hand Soap',
                'category' => 'CSE',
                'description' => "- Non-use of biohazard chemicals such as, but not limited to, ethylene-diamine-tetra-acetate (EDTA) nor alkyl ethoxylates (APEO)\n- Containers can be re-used/recycled",
                'is_active' => true,
                'display_order' => 7,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: LED Lights / Bulb',
                'category' => 'CSE',
                'description' => "- Preferably packaged in recyclable materials",
                'is_active' => true,
                'display_order' => 8,
                'created_at' => $now,
                'updated_at' => $now,
            ],

            [
                'name' => 'Green Spec: Computer, Monitor & Laptop',
                'category' => 'NON-CSE',
                'description' => "- ICT equipment which fulfills at least ENERGY STAR 6.1 Computers and 7.0 for monitor criteria,\n- in case of desktop computers: The Supplier shall supply products which memory, hard disk and CD drive are readily accessible and can be changed easily for upgrades\n- with a visible On/Off switch\n- availability of replacement batteries and power supplies is guaranteed for at least 5 years after end of production\n- in recyclable packages",
                'is_active' => true,
                'display_order' => 9,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: Copiers',
                'category' => 'NON-CSE',
                'description' => "- compliant to ENERGY STAR requirements (currently version 2.0 for imaging Equipment\n- with user instructions for green performance management",
                'is_active' => true,
                'display_order' => 10,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: Refrigerators and Freezers',
                'category' => 'NON-CSE',
                'description' => "- fulfills at least ENERGY STAR 5.0\n- the supplier shall ensure that the products are repairable and that replacement parts are available",
                'is_active' => true,
                'display_order' => 11,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: Airconditioners',
                'category' => 'NON-CSE',
                'description' => "- fulfills at least ENERGY STAR 4.0\n- do not contain \"controlled refrigerants\" or CFC Free\n- the supplier shall ensure that the products are repairable and that replacement parts are available\n- in recyclable packages",
                'is_active' => true,
                'display_order' => 12,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: Paints and Varnishes',
                'category' => 'NON-CSE',
                'description' => "- does not contain mercury, lead, cadmium, hexa-valent chromium, barium, antimony, as well as tributyltin (TBT) and triphenyltin (TPT)\n- the packaging shall be accompanied by a brief statement discouraging improper disposal of the material and encouraging consultation with local authorities for disposal requirements or recycling opportunities as specified in RA 9003 under article 4",
                'is_active' => true,
                'display_order' => 13,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: Textiles',
                'category' => 'NON-CSE',
                'description' => "- the amount of free and partly hydrolysable formaldehyde in the final product shall not exceed 80ppm for products that come into direct contact with the skin and 300ppm for all other products\n- organically produced textiles when possible (preferably natural fiber such as cotton)\n- packaged in recyclable material",
                'is_active' => true,
                'display_order' => 14,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: Toilets and Urinals',
                'category' => 'NON-CSE',
                'description' => "- nominal full flush volume shall not exceed 6.0 L/flush (for urinals 2.0 L/flush)\n- toilet suites delivering a full flush volume of more than 4.0 litres and toilet flushing systems shall be equipped with a water-saving device\n- the reduced flush volume shall not exceed 3.0 L/flush\n- warranty for repair or replacement\n- packaged in materials that should be recyclable",
                'is_active' => true,
                'display_order' => 15,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: Vehicles',
                'category' => 'NON-CSE',
                'description' => "- meets the EURO IV Standard\n- the supplier shall provide a guarantee for the vehicle for a period of at least 3 years or 100,000 km, whichever comes first\n- supplier shall demonstrate guarantee the availability of parts for the specific vehicle model for at least 7 years from the time production of the particular model ceases",
                'is_active' => true,
                'display_order' => 16,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: Food and Catering Services (buffet & packed meals)',
                'category' => 'NON-CSE',
                'description' => "- use of waxed carton instead of Styrofoam (packed meals)\n- use of stainless steel, wooden/bamboo spoon and fork instead of plastic spoon/fork\n- use of glass, disposable paper cup instead of disposable plastic cup\n- use of stainless teaspoon, wooden popsicles sticks instead of plastic stirrer\n- use of glass/personal tumbler instead of single-use plastic bottled water\n- use of glass bottled softdrinks instead of single-use plastic softdrinks bottle\n- use of paper straw instead of plastic straw\n- reduce usage of disposable containers for food, drink & condiments",
                'is_active' => true,
                'display_order' => 17,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Green Spec: Training Facilities / Hotels / Venues',
                'category' => 'NON-CSE',
                'description' => "- preferably the supplier is practicing water saving measures e.g. collect rain water\n- indoor lighting is energy efficient\n- Reduce packaging and usage of disposable/ plastic containers for food, drink and condiments",
                'is_active' => true,
                'display_order' => 18,
                'created_at' => $now,
                'updated_at' => $now,
            ],

            [
                'name' => 'POL Condition (Fuel & Lubricants)',
                'category' => 'GENERAL',
                'description' => "POL Condition:\n-Staggered Delivery based on the latest fuel pump price /At Gasoline Station\n-Staggered Payment: The end-user must ensure that payment is processed within 10 calendar days upon receiving the billing from the supplier/Credit-basis.\n-The supplier reserves the right to discontinue services if payment is not made after two consecutive billings and will resume only after the outstanding obligations are settled.",
                'is_active' => true,
                'display_order' => 19,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Standard 1-Year Warranty Clause',
                'category' => 'GENERAL',
                'description' => "- Standard 1-year on-site warranty for parts and labor upon final acceptance.\n- Replacement of defective units or items within 7 calendar days from receipt of notice.",
                'is_active' => true,
                'display_order' => 20,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('other_terms');
    }
};
