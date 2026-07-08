const { createClient } = require('@supabase/supabase-js');

// Para inicializar el cliente, usamos las variables de entorno.
// Si por alguna razón no están presentes, mostramos una advertencia.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("ADVERTENCIA: Falta SUPABASE_URL o SUPABASE_KEY en el archivo .env.");
    console.error("El bot no podrá conectarse a la base de datos.");
} else {
    console.log("Conectado a Supabase correctamente.");
}

const supabase = createClient(supabaseUrl || 'https://dummy.supabase.co', supabaseKey || 'dummy_key');

module.exports = supabase;
