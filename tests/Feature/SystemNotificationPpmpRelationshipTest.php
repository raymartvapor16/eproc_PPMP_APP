<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\Ppmp;
use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class SystemNotificationPpmpRelationshipTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Office $office;
    private Ppmp $ppmp;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::create([
            'code' => 'TEST-OFFICE',
            'name' => 'Testing Office',
        ]);

        $this->user = User::factory()->create([
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'approval_status' => 'approved',
            'is_active' => true,
        ]);

        $this->ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'PMO-2026-999999',
            'ppmp_number' => 1,
            'fiscal_year' => 2026,
            'title' => 'Sample Procurement for Notification Test',
            'status' => 'DRAFT',
            'office_id' => $this->office->id,
            'created_by' => $this->user->id,
        ]);
    }

    public function test_system_notifications_table_has_ppmp_id_column(): void
    {
        $this->assertTrue(Schema::hasColumn('system_notifications', 'ppmp_id'));
    }

    public function test_system_notification_belongs_to_ppmp(): void
    {
        $notification = SystemNotification::notify(
            $this->user->id,
            'New PPMP Available',
            'A new PPMP has been created.',
            $this->ppmp->id,
            'info'
        );

        $this->assertNotNull($notification->ppmp);
        $this->assertEquals($this->ppmp->id, $notification->ppmp->id);
        $this->assertEquals('Sample Procurement for Notification Test', $notification->ppmp->title);
    }

    public function test_system_notification_notify_accepts_ppmp_model_instance(): void
    {
        $notification = SystemNotification::notify(
            $this->user->id,
            'PPMP Model Instance',
            'Passing PPMP directly into notify helper',
            $this->ppmp,
            'success'
        );

        $this->assertEquals($this->ppmp->id, $notification->ppmp_id);
        $this->assertInstanceOf(Ppmp::class, $notification->ppmp);
    }

    public function test_ppmp_has_many_notifications(): void
    {
        $notif1 = SystemNotification::notify(
            $this->user->id,
            'First Notification',
            'First message',
            $this->ppmp->id
        );

        $notif2 = SystemNotification::notify(
            $this->user->id,
            'Second Notification',
            'Second message',
            $this->ppmp->id
        );

        $this->assertCount(2, $this->ppmp->notifications);
        $this->assertCount(2, $this->ppmp->systemNotifications);
        $this->assertTrue($this->ppmp->notifications->contains('id', $notif1->id));
        $this->assertTrue($this->ppmp->systemNotifications->contains('id', $notif2->id));
    }

    public function test_eager_loading_system_notifications_with_ppmp(): void
    {
        SystemNotification::notify(
            $this->user->id,
            'Eager Load Test',
            'Eager loading test message',
            $this->ppmp->id
        );

        $notification = SystemNotification::with('ppmp')
            ->where('user_id', $this->user->id)
            ->first();

        $this->assertTrue($notification->relationLoaded('ppmp'));
        $this->assertEquals($this->ppmp->uuid, $notification->ppmp->uuid);
    }

    public function test_eager_loading_ppmp_with_system_notifications(): void
    {
        SystemNotification::notify(
            $this->user->id,
            'PPMP Eager Load Test',
            'Eager load notifs',
            $this->ppmp->id
        );

        $loadedPpmp = Ppmp::with('systemNotifications')->find($this->ppmp->id);

        $this->assertTrue($loadedPpmp->relationLoaded('systemNotifications'));
        $this->assertNotEmpty($loadedPpmp->systemNotifications);
    }

    public function test_notifications_api_returns_connected_ppmp(): void
    {
        SystemNotification::notify(
            $this->user->id,
            'API Connection Test',
            'API message connected to PPMP',
            $this->ppmp->id,
            'info'
        );

        $response = $this->actingAs($this->user)->getJson('/api/notifications');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'notifications' => [
                '*' => [
                    'id',
                    'user_id',
                    'ppmp_id',
                    'title',
                    'message',
                    'ppmp' => [
                        'id',
                        'uuid',
                        'tracking_number',
                        'title',
                    ],
                ],
            ],
            'unread_count',
        ]);

        $this->assertEquals($this->ppmp->uuid, $response->json('notifications.0.ppmp.uuid'));
    }

    public function test_deleting_ppmp_sets_ppmp_id_to_null_safely(): void
    {
        $notification = SystemNotification::notify(
            $this->user->id,
            'Delete Safety Test',
            'Message for delete test',
            $this->ppmp->id
        );

        $this->ppmp->delete();

        $notification->refresh();
        $this->assertNull($notification->ppmp_id);
        $this->assertNull($notification->ppmp);
    }
}
