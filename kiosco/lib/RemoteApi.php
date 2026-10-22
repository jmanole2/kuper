<?php

declare(strict_types=1);

/**
 * Cliente HTTPS hacia la API del servidor.
 */
final class RemoteApi
{
    private string $baseUrl;
    private ?string $caFile;

    public function __construct(string $baseUrl, string $caFile)
    {
        $this->baseUrl = rtrim($baseUrl, "/") . "/";
        // En Windows, PHP no trae certificados raíz: se usa cacert.pem junto al programa.
        $this->caFile = is_file($caFile) ? $caFile : null;
    }

    /**
     * Devuelve ["status" => int, "body" => array]. status = 0 significa sin conexión.
     */
    public function post(string $path, array $payload, ?string $token = null, int $timeout = 15): array
    {
        $headers = [
            "Accept: application/json",
            "Content-Type: application/json",
            "User-Agent: KaluzKiosco/" . KIOSCO_VERSION,
        ];

        if ($token !== null) {
            $headers[] = "X-Kaluz-Token: " . $token;
        }

        $curl = curl_init($this->baseUrl . ltrim($path, "/"));
        $options = [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_FOLLOWLOCATION => false,
        ];

        if ($this->caFile !== null) {
            $options[CURLOPT_CAINFO] = $this->caFile;
        }

        curl_setopt_array($curl, $options);
        $response = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $error = curl_error($curl);
        curl_close($curl);

        if ($response === false) {
            return ["status" => 0, "body" => ["error" => $error ?: "Sin conexión"]];
        }

        $body = json_decode((string) $response, true);

        return [
            "status" => $status,
            "body" => is_array($body) ? $body : ["error" => "Respuesta no válida del servidor (HTTP {$status})"],
        ];
    }
}
