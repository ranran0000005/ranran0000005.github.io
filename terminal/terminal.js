/**
 * Fabian Alvarez © 2024 https://fabianalvarez.dev
 * Add a specified delay in milliseconds
 */
const wait = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

// 全局变量：跟踪Python REPL模式和普通命令多行模式
let pythonREPLMode = false;
let pythonMultilineBuffer = '';
let normalCommandMode = false;
let normalCommandBuffer = '';

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
      
      // 如果在Python REPL模式下
      if (pythonREPLMode) {
        // 检查是否输入exit()或quit()
        if (command.trim() === 'exit()' || command.trim() === 'quit()') {
          pythonREPLMode = false;
          pythonMultilineBuffer = '';
          writeText(output, '退出 Python REPL\n');
        } else if (command.trim().endsWith(';')) {
          // 如果以分号结尾，继续输入下一行，不执行
          const lineWithoutSemicolon = command.trim().slice(0, -1);
          pythonMultilineBuffer += lineWithoutSemicolon + '\n';
          writeText(output, '... '); // 显示续行提示符
        } else {
          // 执行Python代码
          pythonMultilineBuffer += command + '\n';
          executePythonREPL(output, pythonMultilineBuffer);
          pythonMultilineBuffer = ''; // 执行后清空缓冲区
        }
      } else if (command.trim().endsWith(';')) {
        // 普通命令模式下的分号换行
        const lineWithoutSemicolon = command.trim().slice(0, -1);
        normalCommandBuffer += lineWithoutSemicolon + '\n';
        writeText(output, '> '); // 显示续行提示符
      } else {
        // 普通命令模式：直接执行或执行缓冲区中的命令
        normalCommandBuffer += command;
        writeText(output, executeCommandBuffer(normalCommandBuffer)); // Write the result of the command execution with a delay
        normalCommandBuffer = ''; // 执行后清空缓冲区
      }
    } else if (e.key === 'Backspace') {
      input.innerHTML = input.innerHTML.slice(0, -1); // Remove the last character on Backspace
    } else if (e.key.length === 1) { // Only add characters with a length of 1 (to ignore Shift, Ctrl, etc.)
      input.insertAdjacentText('beforeend', e.key); // Add typed character to the input
    }
  }
}

// 执行Python REPL代码
async function executePythonREPL(output, code) {
  if (!pyodideReady) {
    writeText(output, '⚠️ Python 环境尚未加载，请稍候...\n');
    return;
  }
  try {
    await window.pyodide.runPythonAsync(code);
    // 获取捕获的输出
    const result = window.pyodide.globals.get('_output').getvalue();
    // 清空缓冲区以供下次使用
    window.pyodide.runPythonAsync('_output.clear()');
    
    if (result) {
      writeText(output, result);
    }
  } catch (err) {
    writeText(output, `❌ Python 错误: ${err.message}\n`);
  }
}


// Función para ejecutar可能包含多行或用分号分割的命令缓冲区
function executeCommandBuffer(commandBuffer) {
    // 首先将分号替换为换行符，支持分号分割的命令
    const normalized = commandBuffer.trim().replace(/;/g, '\n');
    const lines = normalized.split('\n');
    let results = [];
    
    for (let line of lines) {
        line = line.trim();
        if (line) { // 忽略空行
            results.push(execute(line));
        }
    }
    
    return results.join('\n');
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

      // 为移动端添加粘贴功能
      hiddenInput.addEventListener('paste', (e) => {
          e.preventDefault();
          const text = e.clipboardData?.getData('text/plain') || '';
          hiddenInput.value += text;
          input.textContent = hiddenInput.value;
      });

      // Manejar `Enter` en móviles
      hiddenInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
              const command = hiddenInput.value.trim();
              hiddenInput.value = ''; // Limpiar `hiddenInput`
              input.textContent = ''; // Limpiar `command-input`
              
              // 如果在Python REPL模式下
              if (pythonREPLMode) {
                  if (command === 'exit()' || command === 'quit()') {
                      pythonREPLMode = false;
                      pythonMultilineBuffer = '';
                      output.innerHTML += `<br><strong>${command}</strong><br>`;
                      writeText(output, '退出 Python REPL\n', 5, true);
                  } else if (command.endsWith(';')) {
                      // 如果以分号结尾，继续输入下一行，不执行
                      const lineWithoutSemicolon = command.slice(0, -1);
                      pythonMultilineBuffer += lineWithoutSemicolon + '\n';
                      output.innerHTML += `<br><strong>${command}</strong><br>`;
                      writeText(output, '... ', 5, true);
                  } else {
                      pythonMultilineBuffer += command + '\n';
                      output.innerHTML += `<br><strong>${command}</strong><br>`;
                      executePythonREPL(output, pythonMultilineBuffer);
                      pythonMultilineBuffer = '';
                  }
              } else if (command.endsWith(';')) {
                  // 普通命令模式下的分号换行
                  const lineWithoutSemicolon = command.slice(0, -1);
                  normalCommandBuffer += lineWithoutSemicolon + '\n';
                  output.innerHTML += `<br><strong>${command}</strong><br>`;
                  writeText(output, '> ', 5, true);
              } else {
                  normalCommandBuffer += command;
                  const result = executeCommandBuffer(normalCommandBuffer); // Ejecutar el comando
                  output.innerHTML += `<br><strong>${command}</strong><br>`;
                  writeText(output, result, 5, true); // Mostrar el resultado
                  normalCommandBuffer = '';
              }
          }
      });
  } else {
      // Configuración de escritorio: Escuchar eventos de teclado en toda la página
      document.addEventListener('keydown', (e) => handleKeypress(e, input, output));
      
      // 添加粘贴事件处理（Ctrl+V）
      document.addEventListener('paste', async (e) => {
          const noInputHasFocus = () => !['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement.tagName);
          
          if (noInputHasFocus()) {
              e.preventDefault();
              
              // 优先使用事件的clipboardData，否则使用Clipboard API
              let text = e.clipboardData?.getData('text/plain');
              
              if (!text) {
                  try {
                      text = await navigator.clipboard.readText();
                  } catch (err) {
                      console.error('粘贴失败:', err);
                      return;
                  }
              }
              
              // 将粘贴的内容添加到input中
              input.insertAdjacentText('beforeend', text);
              
              // 滚动到底部
              window.scrollTo(0, document.body.scrollHeight);
          }
      });
      
      // 添加右键粘贴功能
      prompt.addEventListener('contextmenu', async (e) => {
          e.preventDefault(); // 阻止默认右键菜单
          
          try {
              // 从剪贴板读取文本
              const text = await navigator.clipboard.readText();
              
              // 将粘贴的内容添加到input中
              input.insertAdjacentText('beforeend', text);
              
              // 滚动到底部
              window.scrollTo(0, document.body.scrollHeight);
          } catch (err) {
              console.error('粘贴失败:', err);
          }
      });
  }
});
