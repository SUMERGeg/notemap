import { createShareHandler } from './handler.ts';
const url=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const origins=(Deno.env.get('NOTEMAP_ORIGINS')??'https://sumergeg.github.io,http://localhost:5175,http://localhost:5173').split(',').map(s=>s.trim());
Deno.serve(createShareHandler({url,serviceKey,origins}));
