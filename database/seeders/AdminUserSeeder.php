<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // ตั้งค่า email fang.nitipoom@gmail.com เป็น admin (super_user)
        $adminEmail = 'fang.nitipoom@gmail.com';
        $adminUser = User::where('email', $adminEmail)->first();
        
        if ($adminUser) {
            // อัปเดต role เป็น super_user
            $adminUser->update([
                'role' => 'super_user',
                'is_super_user' => true,
            ]);
            
            $this->command->info("Updated user {$adminEmail} to admin (super_user) role");
        } else {
            // ถ้ายังไม่มี user นี้ ให้สร้างใหม่
            $adminUser = User::create([
                'name' => 'Fang Admin',
                'email' => $adminEmail,
                'password' => Hash::make('password'), // ควรเปลี่ยนรหัสผ่านหลังจาก login
                'role' => 'super_user',
                'is_super_user' => true,
                'email_verified_at' => now(),
            ]);
            
            $this->command->info("Created admin user: {$adminEmail}");
            $this->command->warn("Please change the password after first login!");
        }
        
        $this->command->info('AdminUserSeeder completed successfully!');
    }
}

