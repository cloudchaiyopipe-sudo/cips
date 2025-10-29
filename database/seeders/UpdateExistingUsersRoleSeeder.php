<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class UpdateExistingUsersRoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Update existing users to have appropriate roles
        \App\Models\User::whereNull('role')->orWhere('role', '')->chunk(100, function ($users) {
            foreach ($users as $user) {
                if ($user->is_super_user) {
                    $user->update(['role' => 'super_user']);
                } else {
                    $user->update(['role' => 'user']);
                }
            }
        });

        $this->command->info('Updated existing users with appropriate roles.');
    }
}
