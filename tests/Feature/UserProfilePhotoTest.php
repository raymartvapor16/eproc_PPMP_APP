<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Office;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UserProfilePhotoTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $office = Office::create([
            'name' => 'Test Office',
            'code' => 'TO',
            'is_active' => true,
        ]);
        $this->user = User::factory()->create([
            'name' => 'Juan Dela Cruz',
            'email' => 'juandelacruz@test.com',
            'role' => 'twg',
            'office_id' => $office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
    }

    public function test_user_can_upload_png_profile_photo_saved_with_sanitized_name()
    {
        $file = UploadedFile::fake()->image('my_photo.png', 200, 200);

        $response = $this->actingAs($this->user)
            ->postJson('/api/profile/photo', [
                'profile_photo' => $file,
            ]);

        $response->assertStatus(200);
        $response->assertJsonStructure(['message', 'user', 'profile_photo_url']);

        $this->user->refresh();
        $this->assertNotNull($this->user->profile_photo_path);

        $this->assertEquals('profile/juandelacruz.png', $this->user->profile_photo_path);
        Storage::disk('local')->assertExists('profile/juandelacruz.png');
    }

    public function test_user_can_upload_jpeg_profile_photo()
    {
        $file = UploadedFile::fake()->image('my_photo.jpg', 200, 200);

        $response = $this->actingAs($this->user)
            ->postJson('/api/profile/photo', [
                'profile_photo' => $file,
            ]);

        $response->assertStatus(200);
        $this->user->refresh();
        $this->assertEquals('profile/juandelacruz.jpg', $this->user->profile_photo_path);
        Storage::disk('local')->assertExists('profile/juandelacruz.jpg');
    }

    public function test_rejects_non_jpeg_png_files()
    {
        $file = UploadedFile::fake()->create('malicious.php', 10, 'application/x-php');

        $response = $this->actingAs($this->user)
            ->postJson('/api/profile/photo', [
                'profile_photo' => $file,
            ]);

        $response->assertStatus(422);
    }

    public function test_avatar_can_be_retrieved_by_authenticated_users()
    {
        $file = UploadedFile::fake()->image('avatar.png', 200, 200);
        $this->actingAs($this->user)->postJson('/api/profile/photo', ['profile_photo' => $file]);

        $otherUser = User::factory()->create(['is_active' => true, 'approval_status' => 'approved']);

        $response = $this->actingAs($otherUser)->get('/api/users/' . User::encryptId($this->user->id) . '/avatar');
        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'image/png');
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    public function test_returns_404_when_user_has_no_avatar()
    {
        $otherUser = User::factory()->create(['is_active' => true, 'approval_status' => 'approved']);

        $response = $this->actingAs($otherUser)->get('/api/users/' . User::encryptId($otherUser->id) . '/avatar');
        $response->assertStatus(404);
    }

    public function test_user_can_remove_profile_photo()
    {
        $file = UploadedFile::fake()->image('avatar.png', 200, 200);
        $this->actingAs($this->user)->postJson('/api/profile/photo', ['profile_photo' => $file]);

        $this->user->refresh();
        $this->assertNotNull($this->user->profile_photo_path);

        $delResponse = $this->actingAs($this->user)->deleteJson('/api/profile/photo');
        $delResponse->assertStatus(200);

        $this->user->refresh();
        $this->assertNull($this->user->profile_photo_path);
        Storage::disk('local')->assertMissing('profile/juandelacruz.png');
    }
}
