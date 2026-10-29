<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Office extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'head_user_id',
        'head_name',
        'designation',
        'responsibility_number',
    ];

    public function head()
    {
        return $this->belongsTo(User::class, 'head_user_id');
    }

    public function users()
    {
        return $this->hasMany(User::class, 'office_id');
    }

    public function ppmps()
    {
        return $this->hasMany(Ppmp::class, 'office_id');
    }

    public function supplierEvaluations()
    {
        return $this->hasMany(SupplierEvaluation::class, 'office_id');
    }

    public function supplierAuthorizes()
    {
        return $this->hasMany(SupplierAuthorize::class, 'office_id');
    }

    public function getAbbreviationAttribute(): ?string
    {
        return $this->code;
    }

    public function getEffectiveHeadUser(): ?User
    {
        if ($this->head_user_id) {
            $user = User::find($this->head_user_id);
            if ($user && $user->is_active) {
                return $user;
            }
        }

        $user = User::where('office_id', $this->id)
            ->where('role', 'head')
            ->where('is_active', true)
            ->first();

        if ($user) {
            $this->updateQuietly(['head_user_id' => $user->id]);
            return $user;
        }

        if (!empty($this->head_name)) {
            $userByName = User::where('name', $this->head_name)
                ->where('is_active', true)
                ->first();
            if ($userByName) {
                $this->updateQuietly(['head_user_id' => $userByName->id]);
                return $userByName;
            }
        }

        return null;
    }

    public function getHeadUsers()
    {
        $users = User::where('office_id', $this->id)
            ->where('role', 'head')
            ->where('is_active', true)
            ->get();

        if ($this->head_user_id) {
            $userById = User::find($this->head_user_id);
            if ($userById && $userById->is_active && !$users->contains('id', $userById->id)) {
                $users->push($userById);
            }
        }

        if ($users->isEmpty() && !empty($this->head_name)) {
            $userByName = User::where('name', $this->head_name)
                ->where('is_active', true)
                ->first();
            if ($userByName) {
                $users->push($userByName);
                $this->updateQuietly(['head_user_id' => $userByName->id]);
            }
        }

        return $users;
    }
}
