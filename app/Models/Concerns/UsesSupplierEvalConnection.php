<?php

namespace App\Models\Concerns;

trait UsesSupplierEvalConnection
{
    public static function supplierEvalConnectionName(): string
    {
        $db = config('database.connections.supplier_eval.database');
        if (is_string($db) && trim($db) !== '') {
            return 'supplier_eval';
        }

        return (string) config('database.default');
    }

    public static function hasDedicatedSupplierEvalDb(): bool
    {
        $db = config('database.connections.supplier_eval.database');
        return is_string($db) && trim($db) !== '';
    }

    public function getConnectionName(): ?string
    {
        return static::hasDedicatedSupplierEvalDb() ? 'supplier_eval' : parent::getConnectionName();
    }
}
