let prevTransparency=null;
let age = null;

function debounce(func, wait) {
    let timeout;
    return function() {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, arguments), wait);
    };
}

function getPageAge() {
    // Try to get the date from the first selector
    let dateString = document.querySelector('div[data-test-id="page-last-modified"] span[id="content-header.by-line.last.updated.version.1"]');
    if (!dateString) {
        // If the first selector didn't work, try the second
        dateString = document.querySelector('span > a[href*="/wiki/pages/diffpagesbyversion.action?pageId="]');
    }
    if (!dateString) {
        // If neither selector worked, return "no age"
        return 0;
    }
    // Parse the date string into a Date object
    let pageDate = new Date(dateString.textContent);
    // Get the current date
    let currentDate = new Date();
    // Calculate the difference in months
    let months = currentDate.getMonth() - pageDate.getMonth() +
        (12 * (currentDate.getFullYear() - pageDate.getFullYear()));
    return months;
}

function calculateColor(transparency) {
    // Convert transparency to a percentage
    const transparencyPercent = transparency * 100;

    // Color components
    const red = 143;
    const green = 89;
    const blue = 34;

    // Calculate lighter color components based on transparency
    const lighterRed = Math.min(255, red + (255 - red) * (transparencyPercent / 100));
    const lighterGreen = Math.min(255, green + (255 - green) * (transparencyPercent / 100));
    const lighterBlue = Math.min(255, blue + (255 - blue) * (transparencyPercent / 100));

    // Convert to hex
    const color = `#${Math.round(lighterRed).toString(16)}${Math.round(lighterGreen).toString(16)}${Math.round(lighterBlue).toString(16)}`;

    return color;
}
function calculateTransparency() {
    // Get page age
    let ageElement = document.querySelector('div[data-test-id="page-last-modified"] span[id="content-header.by-line.last.updated.version.1"]') || document.querySelector('span > a[href*="/wiki/pages/diffpagesbyversion.action?pageId="]');
    age = 'no age';
    let transparency = 0; // Start with maximum transparency

    if (ageElement) {
        let dateStr = ageElement.textContent.trim();
        let date = new Date(dateStr);
        let now = new Date();
        //let diffMonths = Math.floor((now - date) / (1000 * 60 * 60 * 24 * 30)); // approximate months
        // Calculate the difference in months
        let years = now.getFullYear() - date.getFullYear();
        let months = now.getMonth() - date.getMonth();
        let diffMonths = years * 12 + months;
        //Check for NaN because confluence sometimes returns something like "20 minutes ago"
        if (isNaN(diffMonths) || diffMonths < 1) {
            transparency = diffMonths / 12 * 0.7; // Update the transparency to range from 100% to 30% over 6 months
            age = diffMonths.toString() + ' months';
        } else {
            transparency = 0.7; // Minimum transparency (50%)
            age = '12+ months' + diffMonths;
        }
    }
    return transparency;
}

function applyCanvas(){
    let transparency = calculateTransparency();
    if (transparency == prevTransparency) return;
    prevTransparency = transparency;
    // Check for existing canvas
    let oldCanvas = document.getElementById('parchment');
    if (oldCanvas) {
        // Remove existing canvas
        document.body.removeChild(oldCanvas);
    }

    if (transparency==0) return;

    //The older, the browner
    let color = calculateColor(1-transparency);

    // Define the style for the canvas and inject into the page
    let style = document.createElement('style');
    style.innerHTML = `
        #parchment {
            position: absolute;
            display: flex;
            top: 10px;
            bottom: 30px;
            right: 30px;
            width: calc(100vw - 80px);
            height: calc(100vh - 80px);
            z-index: 9999;
            pointer-events: none;
            box-shadow: 2px 3px 20px black, 0 0 125px ${color} inset;
            filter: url(#wavy2);
        }
        .canvas-text {
            font-size: 16px;
            font-family: Arial;
            color: black;
        }
    `;
    document.head.appendChild(style);


    // Create the canvas and inject into the page
    let canvas = document.createElement('canvas');
    canvas.id = 'parchment';
    canvas.style.position = 'fixed';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.top = '5%';
    canvas.style.left = '5%';
    document.body.appendChild(canvas);
    let context = canvas.getContext('2d');

    // Set the parchment transparency
    //document.getElementById('parchment').style.backgroundColor = `rgba(255, 254, 240, ${transparency})`;

    // draw the SVG filter onto the canvas
    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    let filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'wavy2');
    let feTurbulence = document.createElementNS('http://www.w3.org/2000/svg', 'feTurbulence');
    feTurbulence.setAttribute('x', '0');
    feTurbulence.setAttribute('y', '0');
    feTurbulence.setAttribute('baseFrequency', '0.02');
    feTurbulence.setAttribute('numOctaves', '5');
    feTurbulence.setAttribute('seed', '1');
    filter.appendChild(feTurbulence);
    let feDisplacementMap = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
    feDisplacementMap.setAttribute('in', 'SourceGraphic');
    feDisplacementMap.setAttribute('scale', '20');
    filter.appendChild(feDisplacementMap);
    svg.appendChild(filter);
    document.body.appendChild(svg);

    // Draw the transparency level on the canvas
    context.font = '16px Arial';
    context.fillStyle = 'black';
    context.textAlign = 'right';  // Align the text to the right
    let textOffsetX = canvas.width - 20;  // Small offset to not overlap with the edge
    let textOffsetY = 90;  // Small offset to not overlap with the top edge
    context.fillText('Brown-ness: ' + Math.round(transparency * 100) + '%', textOffsetX, textOffsetY);
    context.fillText('Age: ' + age, textOffsetX, textOffsetY+20);

}


// Debounce the applyCanvas function
let debouncedApplyCanvas = debounce(applyCanvas, 1000);

// Apply the canvas immediately on first load
debouncedApplyCanvas();

// Set up a mutation observer to apply the canvas when the page content changes
let observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === "childList") {
            debouncedApplyCanvas();
        }
    });
});

let config = {
    childList: true,
    subtree: true,
};

// Start observing the document body for DOM changes after a delay
setTimeout(function() {
    observer.observe(document.body, config);
}, 1000);  // Delay in milliseconds