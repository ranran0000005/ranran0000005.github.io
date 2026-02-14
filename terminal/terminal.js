/**
 * Fabian Alvarez © 2024 https://fabianalvarez.dev
 * Add a specified delay in milliseconds
 */
const wait = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

// Fucntion to display copyright
async function copyright(delay = 5) {
  const content = "Loading terminaljs by <a href='https://fabianalvarez.dev' target='_blank'>SantaCRC</a>.......\n";
  const outputElement = document.getElementById("asciiText");
  
  // Añadir el texto de manera progresiva
  for (let i = 0; i < content.length; i++) {
    outputElement.textContent += content[i]; // Usamos textContent para evitar interpretación de HTML mientras se escribe
    window.scrollTo(0, document.body.scrollHeight); // Desplaza al final conforme se añade texto
    await wait(delay); // Espera el tiempo especificado antes de añadir el siguiente carácter
  }
  
  // Convertir el texto en HTML una vez terminado
  outputElement.innerHTML = content;
}

// Function to write text to a target element with a specified delay between each character
async function writeText(target, content, delay = 5, is_mobile = false) {
  for (let i = 0; i < content.length; i++) {
    target.innerHTML += content[i]; // Add one character at a time
    if (!is_mobile){
    window.scrollTo(0, document.body.scrollHeight); // Scroll to the bottom as text is added
    } else {
        target.scrollIntoView();
    }
    await wait(delay); // Wait the specified delay before adding the next character
  }
}

// Handle keypresses and interpret input as commands, printing results to the output
function handleKeypress(e, input, output) {
  const noInputHasFocus = () => !['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement.tagName);

  if (noInputHasFocus()) {
    if (e.key === 'Enter') {
      const command = input.innerText; // Capture the command entered
      input.innerHTML = ''; // Clear the input field
      output.innerHTML += `<br><strong>${command}</strong><br>`; // Display entered command in output
      writeText(output, execute(command)); // Write the result of the command execution with a delay
    } else if (e.key === 'Backspace') {
      input.innerHTML = input.innerHTML.slice(0, -1); // Remove the last character on Backspace
    } else if (e.key.length === 1) { // Only add characters with a length of 1 (to ignore Shift, Ctrl, etc.)
      input.insertAdjacentText('beforeend', e.key); // Add typed character to the input
    }
  }
}


// Función para ejecutar el comando con o sin argumentos
function execute(commandInput) {
    let [command, ...args] = commandInput.split(" ");
    command = command.toLowerCase(); 
    
    if (commands[command]) {
        const { function: commandFunction, hasArgs } = commands[command];
        
        if (hasArgs) {
            if (args.length > 0) {
                return commandFunction(...args); // Ejecuta con argumentos
            } else {
                return "This command requires arguments.";
            }
        } else {
            return commandFunction(); // Ejecuta sin argumentos
        }
    }
    
    return "Command not found. Enter 'help' for a list of commands.";
}


// Initialize the page and display ASCII art and instructions with delay
document.addEventListener('DOMContentLoaded', async () => {
  const asciiText = document.getElementById('asciiText');
  const asciiArt = asciiText.innerText;
  asciiText.innerHTML = '';

  const instructions = document.getElementById('instructions');
  const prompt = document.getElementById('prompt');
  const cursor = document.getElementById('cursor');
  const input = document.getElementById('command-input');
  const output = document.getElementById('output');
  const hiddenInput = document.getElementById('hidden-input'); // Input oculto

  await copyright();
  await wait(1000);
  await writeText(asciiText, asciiArt);
  await wait(500);
  await writeText(instructions, "Enter a command. Enter 'help' to see a list of commands.");

  prompt.prepend('>');
  cursor.innerHTML = '_';

  // Detectar si es móvil
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
      // Enfocar `hiddenInput` al tocar el área de `#prompt`
      prompt.addEventListener('click', () => {
          hiddenInput.focus();
      });

      // Actualizar `command-input` con el valor de `hiddenInput`
      hiddenInput.addEventListener('input', () => {
          input.textContent = hiddenInput.value;
      });

      // Manejar `Enter` en móviles
      hiddenInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
              const command = hiddenInput.value.trim();
              hiddenInput.value = ''; // Limpiar `hiddenInput`
              input.textContent = ''; // Limpiar `command-input`
              const result = execute(command); // Ejecutar el comando
              output.innerHTML += `<br><strong>${command}</strong><br>`;
              writeText(output, result, 5, true); // Mostrar el resultado
          }
      });
  } else {
      // Configuración de escritorio: Escuchar eventos de teclado en toda la página
      document.addEventListener('keydown', (e) => handleKeypress(e, input, output));
  }
});
