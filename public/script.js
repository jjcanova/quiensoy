document.addEventListener('DOMContentLoaded', () => {
    
    // Variables Globales
    let mazos = {};
    let palabrasDisponibles = [];
    let tiempoBase = 60;
    let tiempoRestante = 60;
    let intervaloTiempo;
    let jugando = false;
    let accionActivada = false;

    // Variables de la Sala
    let datosSala = []; 
    let turnoActual = 0;
    let rondaActual = 1;
    let palabrasTurno = { adivinadas: [], pasadas: [] };

    // Elementos del DOM
    const pantallas = document.querySelectorAll('.pantalla');
    const inputJugador = document.getElementById('input-jugador');
    const btnAgregarJugador = document.getElementById('btn-agregar-jugador');
    const listaJugadoresMenu = document.getElementById('lista-jugadores-menu');
    const listaOrdenJugadores = document.getElementById('lista-orden-jugadores');
    const selectorCategoria = document.getElementById('selector-categoria');
    const selectorTiempo = document.getElementById('selector-tiempo');

    // 1. Cargar el JSON 
    fetch('mazos.json')
        .then(response => {
            if (!response.ok) throw new Error("No se pudo cargar el archivo");
            return response.json();
        })
        .then(data => {
            mazos = data;
            Object.keys(mazos).forEach(categoria => {
                let option = document.createElement('option');
                option.value = categoria; 
                option.textContent = categoria;
                selectorCategoria.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error con mazos.json:', error);
            alert("No se cargaron las categorías. Asegurate de usar Live Server y de que mazos.json exista.");
        });

    // 2. Agregar Jugadores en el Menú Principal
    btnAgregarJugador.addEventListener('click', agregarJugador);
    inputJugador.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter') agregarJugador(); 
    });

    // Array temporal solo para la creación del menú
    let jugadoresIniciales = [];

    function agregarJugador() {
        const nombre = inputJugador.value.trim();
        if (nombre !== "") {
            jugadoresIniciales.push(nombre);
            actualizarListaJugadoresMenu();
            inputJugador.value = "";
        }
    }

    function actualizarListaJugadoresMenu() {
        listaJugadoresMenu.innerHTML = '';
        jugadoresIniciales.forEach((jugador, index) => {
            let li = document.createElement('li');
            li.textContent = jugador;
            let btnBorrar = document.createElement('span');
            btnBorrar.textContent = "❌"; 
            btnBorrar.style.cursor = "pointer";
            btnBorrar.onclick = () => { 
                jugadoresIniciales.splice(index, 1); 
                actualizarListaJugadoresMenu(); 
            };
            li.appendChild(btnBorrar);
            listaJugadoresMenu.appendChild(li);
        });
    }

    function mostrarPantalla(idPantalla) {
        pantallas.forEach(p => p.classList.remove('activa'));
        document.getElementById(idPantalla).classList.add('activa');
    }

    // 3. Botón "CREAR SALA" (Pasa del Menú al Lobby de Ronda)
    document.getElementById('btn-crear-sala').addEventListener('click', () => {
        if (jugadoresIniciales.length === 0) { 
            alert("¡Agregá al menos un jugador!"); 
            return; 
        }
        
        rondaActual = 1;
        
        // Inicializamos los datos de la sala con los jugadores
        datosSala = jugadoresIniciales.map(nombre => {
            return {
                nombre: nombre, 
                puntosTotales: 0, 
                adivinadas: [], 
                pasadas: []
            };
        });
        
        prepararLobbyRonda();
    });

    // 4. Preparar el Lobby (Orden, Categoría y Tiempo)
    function prepararLobbyRonda() {
        document.getElementById('lobby-numero-ronda').textContent = rondaActual;
        renderizarOrdenJugadores();
        mostrarPantalla('pantalla-lobby');
    }

    // Renderizar la lista con botones de Subir y Bajar
    function renderizarOrdenJugadores() {
        listaOrdenJugadores.innerHTML = '';
        
        datosSala.forEach((jugador, index) => {
            let li = document.createElement('li');
            let nombreSpan = document.createElement('span');
            nombreSpan.textContent = `${index + 1}. ${jugador.nombre}`;
            
            let divControles = document.createElement('div');
            divControles.className = "controles-orden";
            
            // Botón Subir
            let btnSubir = document.createElement('button');
            btnSubir.className = "btn-orden";
            btnSubir.innerHTML = "↑";
            btnSubir.disabled = index === 0; 
            if(index === 0) btnSubir.style.opacity = "0.3";
            
            btnSubir.onclick = () => {
                if (index > 0) {
                    let temp = datosSala[index];
                    datosSala[index] = datosSala[index - 1];
                    datosSala[index - 1] = temp;
                    renderizarOrdenJugadores();
                }
            };

            // Botón Bajar
            let btnBajar = document.createElement('button');
            btnBajar.className = "btn-orden";
            btnBajar.innerHTML = "↓";
            btnBajar.disabled = index === datosSala.length - 1; 
            if(index === datosSala.length - 1) btnBajar.style.opacity = "0.3";

            btnBajar.onclick = () => {
                if (index < datosSala.length - 1) {
                    let temp = datosSala[index];
                    datosSala[index] = datosSala[index + 1];
                    datosSala[index + 1] = temp;
                    renderizarOrdenJugadores();
                }
            };

            divControles.appendChild(btnSubir);
            divControles.appendChild(btnBajar);
            
            li.appendChild(nombreSpan);
            li.appendChild(divControles);
            listaOrdenJugadores.appendChild(li);
        });
    }

    // 5. Botón "INICIAR RONDA" (Pasa del Lobby al Juego)
    document.getElementById('btn-iniciar-ronda').addEventListener('click', () => {
        if (!selectorCategoria.value) {
            alert("No hay categorías cargadas. Revisá tu archivo mazos.json");
            return;
        }

        // Tomar el tiempo elegido para esta ronda
        tiempoBase = parseInt(selectorTiempo.value);

        // Cargar el mazo elegido para esta ronda
        const categoriaElegida = selectorCategoria.value;
        palabrasDisponibles = [...mazos[categoriaElegida]]; 
        turnoActual = 0; // Empezamos con el primer jugador de la lista
        
        // Pedir permiso en iOS solo la primera vez que se inicia a jugar
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(estado => {
                    if (estado === 'granted') {
                        prepararPantallaTurno();
                    } else {
                        alert("Se necesita acceso al sensor.");
                    }
                })
                .catch(console.error);
        } else {
            prepararPantallaTurno();
        }
    });

    // 6. Preparar Turno del Jugador
    function prepararPantallaTurno() {
        document.getElementById('nombre-turno').textContent = datosSala[turnoActual].nombre;
        document.getElementById('numero-ronda').textContent = rondaActual;
        mostrarPantalla('pantalla-turno');
    }

    document.getElementById('btn-empezar-turno').addEventListener('click', iniciarCuentaRegresiva);

    // 7. Cuenta Regresiva
    function iniciarCuentaRegresiva() {
        mostrarPantalla('pantalla-juego');
        const divTiempo = document.getElementById('tiempo');
        const divPalabra = document.getElementById('palabra-actual');
        
        divTiempo.style.display = 'none';
        jugando = false;
        palabrasTurno = { adivinadas: [], pasadas: [] }; 
        
        let cuenta = 3;
        divPalabra.textContent = cuenta;

        let intervaloCuenta = setInterval(() => {
            cuenta--;
            if (cuenta > 0) {
                divPalabra.textContent = cuenta;
            } else if (cuenta === 0) {
                divPalabra.textContent = "¡YA!";
            } else { 
                clearInterval(intervaloCuenta); 
                arrancarRelojJuego(); 
            }
        }, 1000);
    }

    // 8. Motor del Juego
    function arrancarRelojJuego() {
        tiempoRestante = tiempoBase;
        jugando = true;
        
        const divTiempo = document.getElementById('tiempo');
        divTiempo.style.display = 'block'; 
        divTiempo.textContent = tiempoRestante;
        
        mostrarSiguientePalabra();

        intervaloTiempo = setInterval(() => {
            tiempoRestante--;
            divTiempo.textContent = tiempoRestante;
            if (tiempoRestante <= 0) {
                finalizarTurno();
            }
        }, 1000);
    }

    function mostrarSiguientePalabra() {
        if (palabrasDisponibles.length === 0) { 
            finalizarTurno(); 
            return; 
        }
        
        const indiceAzar = Math.floor(Math.random() * palabrasDisponibles.length);
        document.getElementById('palabra-actual').textContent = palabrasDisponibles[indiceAzar];
        palabrasDisponibles.splice(indiceAzar, 1);
    }

    // 9. Evento Giroscopio
    window.addEventListener('deviceorientation', (evento) => {
        if (!jugando || accionActivada) return;

        let inclinacion = evento.gamma;
        let palabraPantalla = document.getElementById('palabra-actual').textContent;

        if (inclinacion > 45) { // CORRECTO
            accionActivada = true;
            palabrasTurno.adivinadas.push(palabraPantalla);
            document.body.classList.add('estado-correcto');
            
            setTimeout(() => {
                document.body.classList.remove('estado-correcto');
                mostrarSiguientePalabra(); 
                accionActivada = false;
            }, 800);

        } else if (inclinacion < -45) { // PASAR
            accionActivada = true;
            palabrasTurno.pasadas.push(palabraPantalla);
            document.body.classList.add('estado-pasar');
            
            setTimeout(() => {
                document.body.classList.remove('estado-pasar');
                mostrarSiguientePalabra(); 
                accionActivada = false;
            }, 800);
        }
    });

    // 10. Finalizar Turno y Ver Resultados
    function finalizarTurno() {
        jugando = false;
        clearInterval(intervaloTiempo);
        
        // Guardar datos en la sala global
        datosSala[turnoActual].adivinadas.push(...palabrasTurno.adivinadas);
        datosSala[turnoActual].pasadas.push(...palabrasTurno.pasadas);
        datosSala[turnoActual].puntosTotales += palabrasTurno.adivinadas.length;

        document.getElementById('puntos-turno').textContent = palabrasTurno.adivinadas.length;
        
        const listaAd = document.getElementById('lista-adivinadas');
        const listaPa = document.getElementById('lista-pasadas');
        listaAd.innerHTML = ''; 
        listaPa.innerHTML = '';
        
        palabrasTurno.adivinadas.forEach(palabra => { 
            let li = document.createElement('li'); 
            li.textContent = palabra; 
            listaAd.appendChild(li); 
        });
        
        palabrasTurno.pasadas.forEach(palabra => { 
            let li = document.createElement('li'); 
            li.textContent = palabra; 
            listaPa.appendChild(li); 
        });

        mostrarPantalla('pantalla-resultados');
    }

    // 11. Botón para ver el Ranking General
    document.getElementById('btn-ver-ranking').addEventListener('click', () => {
        mostrarPantalla('pantalla-posiciones');
        const listaPosiciones = document.getElementById('lista-posiciones');
        listaPosiciones.innerHTML = '';

        // Ordenamos una COPIA del array para no romper el orden original
        let rankingOrdenado = [...datosSala].sort((a, b) => b.puntosTotales - a.puntosTotales);

        rankingOrdenado.forEach((jugador, index) => {
            let li = document.createElement('li');
            let medalla = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔸";
            li.innerHTML = `<span>${medalla} ${jugador.nombre}</span> <span>${jugador.puntosTotales} pts</span>`;
            listaPosiciones.appendChild(li);
        });

        // Cambiar el texto del botón dependiendo si terminó la ronda o no
        const btnSiguiente = document.getElementById('btn-siguiente-accion');
        if (turnoActual >= datosSala.length - 1) {
            btnSiguiente.textContent = "Preparar Siguiente Ronda";
        } else {
            btnSiguiente.textContent = "Siguiente Jugador";
        }
    });

    // 12. Botón Siguiente Acción (Desde el Ranking)
    document.getElementById('btn-siguiente-accion').addEventListener('click', () => {
        if (turnoActual >= datosSala.length - 1) {
            rondaActual++;   
            prepararLobbyRonda(); 
        } else {
            turnoActual++;
            prepararPantallaTurno();
        }
    });

    // 13. Cerrar Sala
    document.getElementById('btn-cerrar-sala').addEventListener('click', () => {
        if(confirm("¿Estás seguro que querés terminar la partida y borrar los puntos?")) {
            jugadoresIniciales = [];
            datosSala = [];
            actualizarListaJugadoresMenu();
            mostrarPantalla('pantalla-inicio');
        }
    });

});