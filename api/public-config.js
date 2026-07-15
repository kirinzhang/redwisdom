module.exports = function publicConfigHandler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Allow', 'GET, OPTIONS');
        return res.status(204).end();
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET, OPTIONS');
        return res.status(405).json({ error: '仅支持 GET 请求' });
    }

    const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
    const supabaseAnonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
    const googleAuthEnabled = String(process.env.SUPABASE_GOOGLE_AUTH_ENABLED || '').toLowerCase() === 'true';
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
        SUPABASE_URL: supabaseUrl,
        SUPABASE_ANON_KEY: supabaseAnonKey,
        SUPABASE_GOOGLE_AUTH_ENABLED: googleAuthEnabled,
        authConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    });
};
