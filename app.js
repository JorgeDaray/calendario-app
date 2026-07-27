// Pega aquí las credenciales que copiaste de Supabase
const supabaseUrl = 'TU_PROJECT_URL_AQUI';
const supabaseKey = 'TU_ANON_KEY_AQUI';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Inicializar el calendario
document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        dateClick: function(info) {
            alert('Hiciste clic en la fecha: ' + info.dateStr);
            // Aquí programaremos la lógica para guardar la disponibilidad en Supabase
        }
    });
    calendar.render();
});