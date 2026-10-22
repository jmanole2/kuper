<?php

// Proceso de sincronización. Corre siempre en segundo plano junto al servidor local:
//   php kiosco/worker.php
//
// Cada pocos segundos:
//   - Avisa al servidor que la computadora está encendida (heartbeat, cada minuto).
//   - Envía los formularios pendientes, en orden, con espera progresiva si falla.
//   - Envía las interacciones medidas en esta computadora.
//
// Con --once hace una sola vuelta (útil para probar).

declare(strict_types=1);

if (PHP_SAPI !== "cli") {
    http_response_code(404);
    exit;
}

require_once __DIR__ . "/lib/bootstrap.php";

$once = in_array("--once", $argv, true);
$config = kioscoConfig();
$lastHeartbeat = 0;
$lastPurge = 0;
$online = false;

kioscoLog("Sincronización iniciada (v" . KIOSCO_VERSION . ").");

do {
    try {
        $store = kioscoStore();
        $token = $store->get("token");

        $store->finishInactiveInteractions((int) $config["interaction_timeout_seconds"]);

        if ($token !== null) {
            $remote = kioscoRemote();
            // Sin internet se vuelve a probar cada 15 s; con internet, cada minuto.
            $interval = $online ? (int) $config["heartbeat_seconds"] : 15;

            if (time() - $lastHeartbeat >= $interval) {
                $online = heartbeat($store, $remote, $token);
                $lastHeartbeat = time();
            }

            if ($online && $store->get("revocado") !== "1") {
                // Si un envío falla por falta de internet, se espera al siguiente heartbeat.
                $online = syncPending($store, $remote, $token)
                    && syncInteractions($store, $remote, $token);
            }

            if (time() - $lastPurge > 3600) {
                $store->purgeSyncedInteractions();
                $lastPurge = time();
            }
        }
    } catch (Throwable $e) {
        kioscoLog("Error en sincronización: " . $e->getMessage());
    }

    if (!$once) {
        sleep(3);
    }
} while (!$once);

function heartbeat(Store $store, RemoteApi $remote, string $token): bool
{
    $result = $remote->post("api/dispositivos/heartbeat/", [
        "equipo" => gethostname() ?: null,
        "version" => KIOSCO_VERSION,
    ], $token, 10);

    if ($result["status"] === 200) {
        $store->set("ultima_conexion", utcNow());
        $store->set("nombre", (string) ($result["body"]["nombre"] ?? ""));
        $store->set("revocado", null);
        $store->set("ultimo_error", null);

        return true;
    }

    if ($result["status"] === 401) {
        // El admin revocó este equipo: se conserva lo pendiente pero no se envía.
        if ($store->get("revocado") !== "1") {
            kioscoLog("El servidor rechazó el token: dispositivo revocado.");
        }

        $store->set("revocado", "1");
        $store->set("ultimo_error", "Dispositivo revocado en el admin. Genera un nuevo código y vuelve a activar.");

        return false;
    }

    $store->set("ultimo_error", "Sin conexión con el servidor: " . ($result["body"]["error"] ?? "HTTP " . $result["status"]));

    return false;
}

function syncPending(Store $store, RemoteApi $remote, string $token): bool
{
    foreach ($store->duePending() as $item) {
        $payload = json_decode($item["payload"], true) ?: [];
        $result = $remote->post(ltrim($item["ruta"], "/"), $payload, $token);
        $status = $result["status"];

        if ($status === 200 || $status === 201) {
            // Confirmado (o ya existía): se borran los datos personales de esta computadora.
            $store->deletePending((int) $item["id"]);
            continue;
        }

        $error = (string) ($result["body"]["error"] ?? "HTTP {$status}");

        if ($status === 422) {
            kioscoLog("Envío rechazado ({$item['event_uuid']}): {$error}");
            $store->rejectPending((int) $item["id"], $error);
            continue;
        }

        $store->retryPendingLater((int) $item["id"], (int) $item["intentos"] + 1, $error);

        // Sin conexión: no tiene caso intentar los demás en esta vuelta.
        if ($status === 0 || $status >= 500 || $status === 401) {
            return false;
        }
    }

    return true;
}

function syncInteractions(Store $store, RemoteApi $remote, string $token): bool
{
    foreach ($store->interactionsToSync() as $row) {
        $sentAt = utcNow();
        $result = $remote->post("api/interacciones/sincronizar/", [
            "interaction_uuid" => $row["uuid"],
            "inicio_at" => $row["inicio_at"],
            "ultima_actividad_at" => $row["ultima_actividad_at"],
            "fin_at" => $row["fin_at"],
            "duracion_segundos" => $row["duracion_segundos"] !== null ? (int) $row["duracion_segundos"] : null,
        ], $token);

        if ($result["status"] === 200) {
            $store->markInteractionSynced($row["uuid"], (int) $row["version"], $sentAt);
            continue;
        }

        if ($result["status"] === 422 || $result["status"] === 409) {
            // Datos que el servidor nunca aceptará: se marcan como enviados para no insistir.
            kioscoLog("Interacción {$row['uuid']} rechazada: " . ($result["body"]["error"] ?? ""));
            $store->markInteractionSynced($row["uuid"], (int) $row["version"], $sentAt);
            continue;
        }

        return false;
    }

    return true;
}
