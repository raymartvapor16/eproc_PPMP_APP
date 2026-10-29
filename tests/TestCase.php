<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        \App\Models\SystemSetting::flushCache();
        \App\Models\PpmpSignatory::flushCache();
        \App\Models\MonitoringProject::flushCache();
    }
}
