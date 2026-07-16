<?php

namespace App\Support;

use App\Models\Field;

class FieldApiFormatter
{
    public static function toListItem(Field $field): array
    {
        $projectStats = self::decodeJson($field->project_stats);
        $projectData = self::decodeJson($field->project_data);

        [$realArea, $realWaterNeed, $realPlants] = self::calculateStats($field, $projectStats, $projectData);

        $slimProjectData = self::slimProjectData($projectData);
        $slimProjectStats = self::slimProjectStats($projectStats);

        return [
            'id' => $field->id,
            'name' => $field->name,
            'customerName' => $field->customer_name,
            'userName' => null,
            'category' => $field->category,
            'folderId' => $field->folder_id,
            'status' => $field->status,
            'isCompleted' => $field->is_completed,
            'area' => [],
            'plantType' => self::resolvePlantType($field, $projectData),
            'totalPlants' => $realPlants,
            'totalArea' => $realArea,
            'total_water_need' => $realWaterNeed,
            'createdAt' => $field->created_at,
            'projectData' => $slimProjectData,
            'project_data' => $slimProjectData,
            'projectStats' => $slimProjectStats,
            'project_stats' => $slimProjectStats,
            'garden_data' => self::slimGardenData(self::decodeJson($field->garden_data)),
            'garden_stats' => self::slimGardenStats(self::decodeJson($field->garden_stats)),
            'greenhouse_data' => self::slimGreenhouseData(self::decodeJson($field->greenhouse_data)),
            'field_crop_data' => self::slimFieldCropData(self::decodeJson($field->field_crop_data)),
        ];
    }

    private static function decodeJson(mixed $value): ?array
    {
        if ($value === null) {
            return null;
        }

        if (is_array($value)) {
            return $value;
        }

        if (! is_string($value) || $value === '') {
            return null;
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @return array{0: float|int, 1: float|int, 2: int}
     */
    private static function calculateStats(Field $field, ?array $projectStats, ?array $projectData): array
    {
        $realArea = 0;
        $realWaterNeed = 0;
        $realPlants = 0;

        if ($field->total_area && $field->total_area > 0) {
            $realArea = $field->total_area < 100
                ? $field->total_area
                : $field->total_area / 1600;
        }

        if ($field->total_water_need && $field->total_water_need > 0) {
            $realWaterNeed = $field->total_water_need;
        }

        if ($field->total_plants && $field->total_plants > 0) {
            $realPlants = $field->total_plants;
        }

        if (($realArea == 0 || $realWaterNeed == 0 || $realPlants == 0) && $projectStats) {
            if ($realArea == 0) {
                $realArea = $projectStats['totalAreaInRai'] ?? $projectStats['totalArea'] ?? 0;
            }
            if ($realWaterNeed == 0) {
                $realWaterNeed = $projectStats['totalWaterNeedPerSession'] ?? $projectStats['totalWaterNeed'] ?? 0;
            }
            if ($realPlants == 0) {
                $realPlants = $projectStats['totalPlants'] ?? 0;
            }

            if (isset($projectStats['results']) && is_array($projectStats['results'])) {
                $results = $projectStats['results'];
                if ($realArea == 0 && isset($results['totalArea'])) {
                    $realArea = $results['totalArea'];
                }
                if ($realWaterNeed == 0 && isset($results['totalWaterRequiredLPM'])) {
                    $realWaterNeed = $results['totalWaterRequiredLPM'];
                }
                if ($realPlants == 0 && isset($results['totalSprinklers'])) {
                    $realPlants = $results['totalSprinklers'];
                }
            }
        }

        if (($realArea == 0 || $realWaterNeed == 0 || $realPlants == 0) && $projectData) {
            if ($realPlants == 0 && isset($projectData['plants']) && is_array($projectData['plants'])) {
                $realPlants = count($projectData['plants']);
            }

            if ($realArea == 0) {
                if (isset($projectData['totalArea']) && $projectData['totalArea'] > 0) {
                    $realArea = $projectData['totalArea'];
                    if ($realArea > 1000) {
                        $realArea = $realArea / 1600;
                    }
                } elseif (isset($projectData['mainArea']) && is_array($projectData['mainArea']) && count($projectData['mainArea']) >= 3) {
                    $coordinates = $projectData['mainArea'];
                    $area = 0;
                    for ($i = 0; $i < count($coordinates); $i++) {
                        $j = ($i + 1) % count($coordinates);
                        $area += $coordinates[$i]['lat'] * $coordinates[$j]['lng'];
                        $area -= $coordinates[$j]['lat'] * $coordinates[$i]['lng'];
                    }
                    $area = abs($area) / 2;

                    $avgLat = array_sum(array_column($coordinates, 'lat')) / count($coordinates);
                    $latFactor = 111000;
                    $lngFactor = 111000 * cos(deg2rad($avgLat));

                    $realArea = ($area * $latFactor * $lngFactor) / 1600;
                }
            }

            if ($realWaterNeed == 0 && isset($projectData['plants']) && is_array($projectData['plants'])) {
                $realWaterNeed = array_sum(array_map(
                    fn ($plant) => $plant['plantData']['waterNeed'] ?? 0,
                    $projectData['plants']
                ));
            }

            if ($realWaterNeed == 0 && isset($projectData['irrigationZones']) && is_array($projectData['irrigationZones'])) {
                $realWaterNeed = array_sum(array_map(
                    fn ($zone) => $zone['totalWaterNeed'] ?? 0,
                    $projectData['irrigationZones']
                ));
            }
        }

        if ($realArea > 1000) {
            $realArea = $realArea / 1600;
        }

        return [$realArea, $realWaterNeed, $realPlants];
    }

    private static function resolvePlantType(Field $field, ?array $projectData): ?array
    {
        if ($projectData && isset($projectData['selectedPlantType']['name'])) {
            return [
                'id' => $projectData['selectedPlantType']['id'] ?? ($field->plantType->id ?? null),
                'name' => $projectData['selectedPlantType']['name'],
                'type' => $projectData['selectedPlantType']['type'] ?? ($field->plantType->type ?? 'horticulture'),
                'plant_spacing' => $projectData['selectedPlantType']['plantSpacing'] ?? ($field->plantType->plant_spacing ?? 0),
                'row_spacing' => $projectData['selectedPlantType']['rowSpacing'] ?? ($field->plantType->row_spacing ?? 0),
                'water_needed' => $projectData['selectedPlantType']['waterNeed'] ?? ($field->plantType->water_needed ?? 0),
            ];
        }

        if ($field->plantType) {
            return [
                'id' => $field->plantType->id,
                'name' => $field->plantType->name,
                'type' => $field->plantType->type,
                'plant_spacing' => $field->plantType->plant_spacing,
                'row_spacing' => $field->plantType->row_spacing,
                'water_needed' => $field->plantType->water_needed,
            ];
        }

        return null;
    }

    private static function slimProjectData(?array $data): ?array
    {
        if (! $data) {
            return null;
        }

        $slim = [];

        if (isset($data['mainArea']) && is_array($data['mainArea'])) {
            $slim['mainArea'] = $data['mainArea'];
        }

        if (isset($data['selectedPlantType']) && is_array($data['selectedPlantType'])) {
            $slim['selectedPlantType'] = $data['selectedPlantType'];
        }

        if (isset($data['projectImage']) && is_string($data['projectImage']) && ! str_starts_with($data['projectImage'], 'data:image/')) {
            $slim['projectImage'] = $data['projectImage'];
        }

        return $slim ?: null;
    }

    private static function slimProjectStats(?array $stats): ?array
    {
        if (! $stats) {
            return null;
        }

        $slim = [];

        if (array_key_exists('totalCost', $stats)) {
            $slim['totalCost'] = $stats['totalCost'];
        }

        return $slim ?: null;
    }

    private static function slimGardenData(?array $data): ?array
    {
        if (! $data) {
            return null;
        }

        unset($data['canvasData']);

        if (isset($data['imageData']) && is_array($data['imageData'])) {
            $imageData = $data['imageData'];
            $data['imageData'] = array_filter([
                'url' => $imageData['url'] ?? null,
                'width' => $imageData['width'] ?? null,
                'height' => $imageData['height'] ?? null,
                'scale' => $imageData['scale'] ?? null,
            ], fn ($value) => $value !== null);
        }

        return $data;
    }

    private static function slimGardenStats(?array $stats): ?array
    {
        if (! $stats || ! isset($stats['summary']) || ! is_array($stats['summary'])) {
            return $stats;
        }

        return [
            'summary' => array_filter([
                'totalArea' => $stats['summary']['totalArea'] ?? null,
                'totalZones' => $stats['summary']['totalZones'] ?? null,
                'totalSprinklers' => $stats['summary']['totalSprinklers'] ?? null,
            ], fn ($value) => $value !== null),
        ];
    }

    private static function slimGreenhouseData(?array $data): ?array
    {
        if (! $data) {
            return null;
        }

        $slim = [];

        if (isset($data['summary']) && is_array($data['summary'])) {
            $slim['summary'] = $data['summary'];
        }

        if (isset($data['selectedCrops'])) {
            $slim['selectedCrops'] = $data['selectedCrops'];
        }

        if (isset($data['irrigationMethod'])) {
            $slim['irrigationMethod'] = $data['irrigationMethod'];
        }

        if (isset($data['rawData']['shapes']) && is_array($data['rawData']['shapes'])) {
            $slim['rawData'] = [
                'shapes' => array_map(function ($shape) {
                    return array_filter([
                        'type' => $shape['type'] ?? null,
                        'area' => $shape['area'] ?? null,
                        'width' => $shape['width'] ?? null,
                        'height' => $shape['height'] ?? null,
                        'coordinates' => $shape['coordinates'] ?? null,
                    ], fn ($value) => $value !== null);
                }, $data['rawData']['shapes']),
            ];
        }

        return $slim ?: null;
    }

    private static function slimFieldCropData(?array $data): ?array
    {
        if (! $data) {
            return null;
        }

        $slim = [];

        if (isset($data['area']) && is_array($data['area'])) {
            $slim['area'] = array_filter([
                'sizeInRai' => $data['area']['sizeInRai'] ?? null,
                'rai' => $data['area']['rai'] ?? null,
            ], fn ($value) => $value !== null);
        }

        if (isset($data['crops']) && is_array($data['crops'])) {
            $slim['crops'] = array_filter([
                'zoneAssignments' => $data['crops']['zoneAssignments'] ?? $data['crops']['zone_assignments'] ?? null,
                'selectedCrops' => $data['crops']['selectedCrops'] ?? $data['crops']['selected_crops'] ?? null,
            ], fn ($value) => $value !== null);
        }

        if (isset($data['zones']['info']) && is_array($data['zones']['info'])) {
            $slim['zones'] = [
                'info' => array_map(function ($zone) {
                    return array_filter([
                        'cropType' => $zone['cropType'] ?? $zone['crop_type'] ?? null,
                        'areaInRai' => $zone['areaInRai'] ?? null,
                        'area' => $zone['area'] ?? null,
                        'sprinklerCount' => $zone['sprinklerCount'] ?? null,
                        'totalPlantingPoints' => $zone['totalPlantingPoints'] ?? null,
                        'totalWaterRequirementPerDay' => $zone['totalWaterRequirementPerDay'] ?? null,
                    ], fn ($value) => $value !== null);
                }, $data['zones']['info']),
            ];
        }

        if (isset($data['irrigation']) && is_array($data['irrigation'])) {
            $slim['irrigation'] = array_filter([
                'totalCount' => $data['irrigation']['totalCount'] ?? null,
            ], fn ($value) => $value !== null);
        }

        if (isset($data['summary']) && is_array($data['summary'])) {
            $slim['summary'] = array_filter([
                'totalPlantingPoints' => $data['summary']['totalPlantingPoints'] ?? null,
                'totalWaterRequirementPerDay' => $data['summary']['totalWaterRequirementPerDay'] ?? null,
            ], fn ($value) => $value !== null);
        }

        return $slim ?: null;
    }
}
