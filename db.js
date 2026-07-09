require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ADVERTENCIA: Falta SUPABASE_URL o SUPABASE_KEY en el archivo .env.');
    console.error('El bot no podrá conectarse a la base de datos.');
} else {
    console.log('Supabase listo para usar con la URL configurada.');
}

const supabase = createClient(supabaseUrl || 'https://dummy.supabase.co', supabaseKey || 'dummy_key');

module.exports = supabase;
