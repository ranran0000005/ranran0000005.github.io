/**
 * Fabian Alvarez © 2024 https://fabianalvarez.dev
 * Dictionary of commands, their descriptions, and associated functions
 */
let commands = {
    '': {
        // Placeholder command to demonstrate the `noShow` property. This command will be hidden in the help list.
        description: 'Empty command',
        function: () => '\n',
        noShow: true,
    },
    'clear': {
        description: 'Clear the screen',
        function: clearScreen,
    },
    'help': {
        description: 'List available commands',
        function: displayHelp,
    },
    'hello': {
        description: 'Display "Hello World"',
        function: helloWorld,
    },
    'apod': {
        description: 'Fetch the Astronomy Picture of the Day',
        function: getAPOD,
    },
    'echo': {
        description: 'Repeat the input text',
        function: echo,
        hasArgs: true,
    },
    'date': {
        description: 'Display the current date',
        function: () => new Date().toLocaleDateString(),
    },
};

// Returns the text "Hello World"
function helloWorld() {
    return 'Hello World';
}

// Displays a list of available commands
function displayHelp() {
    let helpText = 'Enter a command to execute. Available commands:\n';
    for (let command in commands) {
        if (!commands[command].noShow) {
            helpText += `${command} - ${commands[command].description}\n`;
        }
    }
    return helpText;
}

// Clears the screen by hiding ASCII text and emptying output content
function clearScreen() {
    document.getElementById('asciiText').style.display = 'none';
    document.getElementById('output').innerHTML = '';
    return '';
}

// Fetches the Astronomy Picture of the Day (APOD) and displays it
function getAPOD() {
    return fetch(`https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY`) // Replace DEMO_KEY with your actual API key
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error fetching APOD: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            let content;
            if (data.media_type === "image") {
                content = `
                    <div class="apod-container">
                        <h1>${data.title}</h1>
                        <img src="${data.url}" alt="${data.title}" style="max-width: 100%;">
                        <p>${data.explanation}</p>
                    </div>
                `;
            } else if (data.media_type === "video") {
                content = `
                    <div class="apod-container">
                        <h1>${data.title}</h1>
                        <iframe src="${data.url}" frameborder="0" allowfullscreen style="width: 100%; height: 400px;"></iframe>
                        <p>${data.explanation}</p>
                    </div>
                `;
            } else {
                content = `<p>Today's content is not available in image or video format.</p>`;
            }
            content = 'Retrieved Astronomy Picture of the Day:\n' + content;
            document.getElementById('output').innerHTML = document.getElementById('output').innerHTML+content;
            window.scrollTo(0, document.body.scrollHeight);
            return content;
        })
        .catch(error => {
            console.error('Error fetching APOD:', error);
            const errorMessage = `<p>Error loading content. Please try again later.</p>`;
            document.getElementById('output').innerHTML = errorMessage;
            return errorMessage;
        });
}



function echo(...args) {
    return args.join(' ');
}