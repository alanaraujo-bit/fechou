import Constants from 'expo-constants';

// API de produção na Railway — padrão em qualquer ambiente.
const RAILWAY_URL = 'https://fechou-api-production-e265.up.railway.app';

function resolveApiUrl(): string {
  // Override manual (ex.: EXPO_PUBLIC_API_URL=http://192.168.x.x:3333 pra depurar a API localmente).
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  return RAILWAY_URL;
}

// Mantido pra depuração local: "<ip-da-máquina-dev>:8081" → API no mesmo IP, porta 3333.
export function apiUrlDevLocal(): string | null {
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return devHost ? `http://${devHost}:3333` : null;
}

export const API_URL = resolveApiUrl();
