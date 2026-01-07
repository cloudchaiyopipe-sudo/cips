<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = [
        'name',
        'description',
        'price',
        'original_price',
        'category',
        'discount',
        'image_url',
        'video_url',
        'equipment_id',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'original_price' => 'decimal:2',
        'discount' => 'decimal:2',
        'equipment_id' => 'integer',
    ];

    public function equipment()
    {
        return $this->belongsTo(Equipment::class);
    }
}
