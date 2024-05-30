window.onbeforeunload = function(e) {
    board.ctx.clearRect(0, 0, board.info.width, board.info.height);
    return "Are you sure that you want to leave?  (Unsaved progress may get lost)";
};

const board = {
    ctx: document.querySelector("#gameField canvas").getContext("2d"),
    state: Array.from(Array(22), () => new Array(10).fill(0)), // y / x

    info: {
        width: 480,
        height: 1056,
        cellSize: 48
    },
};

const next = document.querySelector("#next canvas");
const next_ctx = next.getContext("2d");

const coming = document.getElementById("coming");
const coming_ctx = coming.getContext("2d");

const holding = document.querySelector("#holding canvas");
const holding_ctx = holding.getContext("2d");



// piece, orientation: 0 = original, 1 = rotated 90° CW, 2 = flipped, 3 = rotated 90° CCW
const shMetrominos  = [
    [ // O
        [
            [7, 7],
            [7, 7]
        ]
    ],
    [ // I
        [
            [],
            [1, 1, 1, 1],
            [],
            []
        ],
        [
            [0, 0, 1],
            [0, 0, 1],
            [0, 0, 1],
            [0, 0, 1]
        ],
        [
            [],
            [],
            [1, 1, 1, 1],
            []
        ],
        [
            [0, 1],
            [0, 1],
            [0, 1],
            [0, 1]
        ]
    ],
    [ // T
        [
            [0, 2],
            [2, 2, 2],
            []
        ],
        [
            [0, 2],
            [0, 2, 2],
            [0, 2]
        ],
        [
            [],
            [2, 2, 2],
            [0, 2]
        ],
        [
            [0, 2],
            [2, 2],
            [0, 2]
        ]
    ],
    [ // S
        [
            [0, 3, 3],
            [3, 3],
            []
        ],
        [
            [0, 3],
            [0, 3, 3],
            [0, 0, 3]
        ],
        [
            [],
            [0, 3, 3],
            [3, 3]
        ],
        [
            [3],
            [3, 3],
            [0, 3]
        ]
    ],
    [ // Z
        [
            [4, 4],
            [0, 4, 4],
            []
        ],
        [
            [0, 0, 4],
            [0, 4, 4],
            [0, 4]
        ],
        [
            [],
            [4, 4],
            [0, 4, 4]
        ],
        [
            [0, 4],
            [4, 4],
            [4]
        ]
    ],  
    [ // J
        [
            [5],
            [5, 5, 5],
            []
        ],
        [
            [0, 5, 5],
            [0, 5],
            [0, 5]
        ],
        [
            [],
            [5, 5, 5],
            [0, 0, 5]
        ],
        [
            [0, 5],
            [0, 5],
            [5, 5]
        ]
    ],
    [ // L
        [
            [0, 0, 6],
            [6, 6, 6],
            []
        ],
        [
            [0, 6],
            [0, 6],
            [0, 6, 6]
        ],
        [
            [],
            [6, 6, 6],
            [6]
        ],
        [
            [6, 6],
            [0, 6],
            [0, 6]
        ]
    ]
];
const colours = [
    null,       // empty
    "#EEEE57",  // O
    "#00B6EB",  // I
    "#7900EB",  // T
    "#44CC00",  // S
    "#CC0029",  // Z
    "#2920D4",  // J
    "#FA7A01",  // L
    "#825EEE"   // canvas text
];


const game = {
    state: {
        playing: false,
        starting: false,
        gameOver: true,
        timed: false,
        classic: true,
        leveling: true
    },

    stats: {
        level: 1,
        score: 0,
        /////// total, s, d, t, q | T-s,-d,-t | P C
        cleared: [0,   0, 0, 0, 0,    0, 0, 0,   0]
    },

    shMetrominos: {
        next: [],
        sevenBag: true,
        bag: [],
        bagIndex: 0
    },

    time: {
        timer: null,  
        ms: 0,  
        s: 0,  
        min: 0
    }
};

const player = {
    pos: {x: 3, y: 0},
    shMetromino: 0,

    orientation: 0,
    lastSpin: 0,

    holding: -1,
    swapped: false,

    stats: {
        highscore:{
            total: 0,
            highScoreBlitz: 0,
            highScore40Lines: 0
        },

        score: 0,
        /////// total, s, d, t, q | T-s,-d,-t | P C
        cleared: [0,   0, 0, 0, 0,    0, 0, 0,   0]
    }
};

const controller = {
    controls: {
        left: ["a", "not-set"],
        right: ["d", "not-set"], 
        softDrop: ["s", "not-set"],
        hardDrop: [" ", "not-set"],
    
        spin_cw: ["arrowright", "not-set"],
        spin_ccw: ["arrowleft", "not-set"],
        flip: ["arrowup", "arrowdown"], 
    
        hold: ["shift", "not-set"],

        start: [" ", "Enter"],
        pause: ["escape", "p"],
        reset: ["backspace", "not-set"],
    
        menu: {
            up: ["w", "arrowup"],
            //left: ["a", "arrowleft"],
            down: ["s", "arrowdown"],
            //right: ["d", "arrowright"],
            
            enter: ["enter", "d"],
            back: ["backspace", "a"],
            close: ["escape", "not-set"]
        }
    },

    pressed: {
        left: 0,
        right: 0,

        softDrop: false,
        hardDrop: false,

        control: false
    },

    movement: {
        AS: {
            enabled: true,
            ongoing: null
        },

        SD: {
            ongoing: null,

            instantLock: false,
            locking: 0,
            lockDelay: 2000 
        },

        ARR: 3,    // Automatic Repeat Rate  ->   83.33 - 0 ms      ->  5 - 0 F,    0.1      (3)       (for 60 fps)
        DAS: 8,    // Delayed Auto Shift     ->   333.33 - 1.67 ms  ->  20 - 1 F,   0.1      (8)
        //DCD: 0,  // DAS Cut Delay          ->   333.33 - 0 ms     ->  20 - 0 F,   0.1      (0)
        
        SDF: 8,    // Soft Drop Factor       ->   5 - 40 x,                         1        (8)
    }
};

const gravity = [
    0,
    0.01667,
    0.021017,
    0.026977,
    0.035256,
    0.04693,
    0.06361,
    0.0879,
    0.1236,
    0.1775,
    0.2598,
    0.388,
    0.59,
    0.92,
    1.46,
    2.36,
    3.78,
    5
];



drawGrid();
board.ctx.font = "144px monospace";
board.ctx.textBaseline = "middle";
board.ctx.textAlign = "center";










// all eventListerners - handles controller inputs and gravity

document.addEventListener("keydown", (e) => {
    //console.log(e.key)

    if(e.key != "F12" && e.key != "F5")
        e.preventDefault();

    if(game.state.playing){
        if(e.repeat)
           return;

        switch(e.key.toLowerCase()){
            case controller.controls.left[0]:
            case controller.controls.left[1]:{
                if(controller.pressed.left)
                    return;

                controller.pressed.left = controller.pressed.right + 1;
                
                if(!controller.pressed.hardDrop){
                    controller.movement.AS.enabled = false;
                    clearTimeout(controller.movement.AS.ongoing);
                    moveHorizontally(player.pos.x - 1);
                    controller.movement.AS.ongoing = setTimeout(() => { 
                        controller.movement.AS.enabled = true;
                        autoShift(); 
                    }, ((controller.movement.DAS * 1000) / 60));
                    return;
                }
            }
                
            case controller.controls.right[0]:
            case controller.controls.right[1]:{
                if(controller.pressed.right)
                    return;

                controller.pressed.right = controller.pressed.left + 1;
                
                if(!controller.pressed.hardDrop){
                    controller.movement.AS.enabled = false;
                    clearTimeout(controller.movement.AS.ongoing);
                    moveHorizontally(player.pos.x + 1);
                    controller.movement.AS.ongoing = setTimeout(() => { 
                        controller.movement.AS.enabled = true; 
                        autoShift();
                    }, ((controller.movement.DAS * 1000) / 60));
                    return;
                }
            }
    
            case controller.controls.softDrop[0]:
            case controller.controls.softDrop[1]:{
                if(!controller.pressed.softDrop){
                    controller.pressed.softDrop = true;

                    place();
                    moveDown();
                    game.stats.score++;
                    updateScore(0);

                    let timer = (1000 / 60) / gravity[game.stats.level];
                    clearTimeout(controller.movement.SD.ongoing);
                    controller.movement.SD.ongoing = setTimeout(() => {
                        drop(); 
                        moveDown();
                        game.stats.score++;
                    }, (timer / controller.movement.SDF));
                }
                return;
            }

            case controller.controls.hardDrop[0]:
            case controller.controls.hardDrop[1]:{
                controller.pressed.hardDrop = true;
                hardDrop();
                return;
            }
    
            case controller.controls.spin_ccw[0]:
            case controller.controls.spin_ccw[1]:{
                spin(-1);
                return;
            }
    
            case controller.controls.spin_cw[0]:
            case controller.controls.spin_cw[1]:{
                spin(1);
                return;
            }
    
            case controller.controls.flip[0]:
            case controller.controls.flip[1]:{
                spin(2);
                return;
            }
    
            case controller.controls.hold[0]:
            case controller.controls.hold[1]:{
                swapHolding();
                return;
            }
    
            case controller.controls.pause[0]:
            case controller.controls.pause[1]:{
                pause();
                return;
            }
    
            case controller.controls.reset[0]:
            case controller.controls.reset[1]: {
                reset();
                return;
            }

            default: return;
        }
    }
    else if(game.state.starting){
        if(e.repeat)
           return;

        switch(e.key.toLowerCase()){
            case controller.controls.left[0]:
            case controller.controls.left[1]:
                controller.pressed.left = controller.pressed.right + 1;
                return;
                
            case controller.controls.right[0]:
            case controller.controls.right[1]:
                controller.pressed.right = controller.pressed.left + 1;
                return;
    
            case controller.controls.softDrop[0]:
            case controller.controls.softDrop[1]:
                controller.pressed.softDrop = true;
                return;

            default: return;
        }
    }
    //else if(){ //menu stuff }
    else{
        if(e.repeat)
            return;
    
        switch(e.key.toLowerCase()){
            case controller.controls.start[0]:
            case controller.controls.start[1]:
            case controller.controls.pause[0]:
            case controller.controls.pause[1]:{
                controller.pressed.start = true;
                start();
                return;
            }

            case controller.controls.reset[0]:
            case controller.controls.reset[1]:{
                controller.pressed.start = true;
                reset();
                return;
            }

            case "tab":{
                if(!game.state.gameOver)
                    return;

                game.state.timed = !game.state.timed;
                resetTime();
                return;
            }

            default: return;
        }
    }
});

document.addEventListener("keyup", (e) => {
    if(e.key.toLowerCase() == controller.controls.left[0] ||
      e.key.toLowerCase() == controller.controls.left[1]){
        controller.pressed.left = 0;
    }  
    else if(e.key.toLowerCase() == controller.controls.right[0] ||
            e.key.toLowerCase() == controller.controls.right[1]){
        controller.pressed.right = 0;
    }
    else if(e.key.toLowerCase() == controller.controls.softDrop[0] ||
            e.key.toLowerCase() == controller.controls.softDrop[1]){
        controller.pressed.softDrop = false;
        clearTimeout(controller.movement.SD.ongoing);
        let timer = (1000 / 60) / gravity[game.stats.level];
        controller.movement.SD.ongoing = setTimeout(() => {
            drop();
        }, (timer));
    }
    //else if(){}
});



function autoShift(){
    if(!game.state.playing)
        return;

    controller.movement.AS.ongoing = setTimeout(() => { 
        if(controller.movement.AS.enabled)
            autoShift(); 
    }, ((controller.movement.ARR * 1000) / 60));

    if(controller.pressed.left && controller.pressed.right){
        if(controller.pressed.left > controller.pressed.right)
            moveHorizontally(player.pos.x - 1);

        else if(!controller.pressed.hardDrop) 
            moveHorizontally(player.pos.x + 1);
    }
    else if(controller.pressed.left)
        moveHorizontally(player.pos.x - 1);
            
    else if(controller.pressed.right)
        moveHorizontally(player.pos.x + 1);
}

function aSDelay(){
    if(!controller.pressed.hardDrop){
        controller.movement.AS.enabled = false;
        clearTimeout(controller.movement.AS.ongoing);
        moveHorizontally(player.pos.x - 1);
        controller.movement.AS.ongoing = setTimeout(() => { 
            controller.movement.AS.enabled = true;
            autoShift(); 
        }, ((controller.movement.DAS * 1000) / 60));
    }
}

function drop(){
    if(!game.state.playing)
        return;

    let timer = (1000 / 60) / gravity[game.stats.level];
    if(controller.pressed.softDrop){
        controller.movement.SD.ongoing = setTimeout(() => {
            drop();
            
            if(!collision(player.pos.x, (player.pos.y + 1), player.orientation))
                game.stats.score++;
        
            moveDown();
            updateScore(0);
        }, (timer / controller.movement.SDF));
    }
    else{
        controller.movement.SD.ongoing = setTimeout(() => {
            drop(); 
            moveDown();
        }, timer);
    }
}

function hardDrop(){
    clearTimeout(controller.movement.SD.ongoing);
    while(!collision(player.pos.x, (player.pos.y + 1), player.orientation)){
        player.pos.y++;
        game.stats.score += 2;
    }
    place();
    drop();
    drawBoard();
    updateScore(0);
    controller.pressed.hardDrop = false;
}








// game states

function start(){
    if(!game.state.gameOver){
        resume();
        return;
    }
    
    reset();
    shuffleBag();
    game.state.starting = true;
    
    board.ctx.fillStyle = colours[8];
    board.ctx.clearRect(0, 0, board.info.width, board.info.height);
    board.ctx.fillText("3", (board.info.width / 2), (board.info.height / 2));
    setTimeout(() => {
        board.ctx.clearRect(0, 0, board.info.width, board.info.height);
        board.ctx.fillText("2", (board.info.width / 2), (board.info.height / 2));
        setTimeout(() => {
            board.ctx.clearRect(0, 0, board.info.width, board.info.height);
            board.ctx.fillText("1", (board.info.width / 2), (board.info.height / 2));
            setTimeout(() => {
                startTime();
                nextPiece();
                game.state.playing = true;
                game.state.gameOver = false;
                
                clearTimeout(controller.movement.SD.ongoing);
                let timer = (1000 / 60) / gravity[game.stats.level];
                controller.movement.SD.ongoing = setTimeout(() => {
                    drop(); 
                    moveDown();
                }, controller.pressed.softDrop ? (timer / controller.movement.SDF) : timer);

                setTimeout(() => {
                    game.state.starting = false;
                }, 3000);
            }, 1000);
        }, 1000);
    }, 1000);
}

function pause(){
    if(game.state.timed || game.state.starting)
        return;

    clearTimeout(controller.movement.SD.ongoing);
    controller.movement.SD.ongoing = null;
    clearInterval(game.time.timer);
    game.state.playing = false;
    board.ctx.clearRect(0, 0, board.info.width, board.info.height);
    // bring up menu?
}

function resume(){
    if(game.state.starting)
        return;

    game.state.starting = true;
    drawBoard();
    board.ctx.fillStyle = colours[8];
    board.ctx.fillText("3", (board.info.width / 2), (board.info.height / 2));

    setTimeout(() => {
        drawBoard();
        board.ctx.fillStyle = colours[8];
        board.ctx.fillText("2", (board.info.width / 2), (board.info.height / 2));

        setTimeout(() => {
            drawBoard();
            board.ctx.fillStyle = colours[8];
            board.ctx.fillText("1", (board.info.width / 2), (board.info.height / 2));

            setTimeout(() => {
                startTime();
                drawBoard();
                game.state.playing = true;

                clearTimeout(controller.movement.SD.ongoing);
                let timer = (1000 / 60) / gravity[game.stats.level];
                controller.movement.SD.ongoing = setTimeout(() => {
                    drop(); 
                    moveDown();
                }, controller.pressed.softDrop ? (timer / controller.movement.SDF) : timer);

                setTimeout(() => {
                    game.state.starting = false;
                }, 3000);
            }, 1000);
        }, 1000);
    }, 1000);
}

function reset(){
    clearTimeout(controller.movement.SD.ongoing);
    controller.movement.SD.ongoing = null;

    board.state = Array.from(Array(22), () => new Array(10).fill(0));
    board.ctx.clearRect(0, 0, board.info.width, board.info.height);
    next_ctx.clearRect(0, 0, 168, 168);
    coming_ctx.clearRect(0, 0, board.info.width, board.info.height);
    holding_ctx.clearRect(0, 0, 168, 168);
    
    game.state.playing = false;
    game.state.gameOver = true;
    game.stats.level = 1;
    let level = document.querySelector("div:has(>.info):nth-child(1) .info:nth-child(2) b");
    level.innerHTML = game.stats.level;

    clearScore();

    game.shMetrominos.bag = [];
    game.shMetrominos.next = [];
    player.holding = -1;

    resetTime();
}

function gameOver(timeUp){
    if(!collision(player.pos.x, player.pos.y, player.orientation) && !timeUp)
        return;

    clearTimeout(controller.movement.SD.ongoing);
    clearInterval(game.time.timer);
    controller.movement.SD.ongoing = null;
    game.state.playing = false;
    game.state.gameOver = true;
}










// game logic

function moveHorizontally(x){
    if(!collision(x, player.pos.y, player.orientation)){
        player.pos.x = x;
        drawBoard();
        player.lastSpin = 0;
    }
}

function moveDown(){
    if(!collision(player.pos.x, (player.pos.y + 1), player.orientation)){
        //controller.movement.SD.lockDelay += 3;
        player.pos.y++;
        drawBoard();
        player.lastSpin = 0;
    }
    else if(!controller.movement.instantLock){// || locking delay counter thingie 
        if(controller.movement.SD.instantLock){
            place();
            return;
        }
        if(controller.movement.SD.locking){
            if(!controller.pressed.left && !controller.pressed.right)
                place();

            return;
        }

        let timer = (1000 / 60) * game.stats.level;
        controller.movement.SD.locking = setTimeout(() => {
            clearTimeout(controller.movement.SD.locking);
            controller.movement.SD.locking = null;
            place();

        }, (timer > 1000) ? timer : 1000);
    }
}



/**
 * Changes the current shMetromino's orientation.
 * @param {*} orientation -1 = rotate counterclock-wise, 1 = rotated clock-wise, 2 = flip
 */
function spin(rotation){
    if(!player.shMetromino)
        return;

    let orientation = (player.orientation + (rotation) + 4) % 4;
    if(!kickTables(player.pos.x, player.pos.y, orientation)){
        player.lastSpin = 0;
        return;
    }

    player.orientation = orientation;

    // check if there's collision above for spin
    if(!player.lastSpin && (player.shMetromino == 2) && collision(player.pos.x, (player.pos.y - 1), orientation))
        player.lastSpin = 1;

    drawBoard();
}

function kickTables(x, y, rotation){
    if(!collision(x, y, rotation))
        return 1;

    let orientation = player.orientation;

    /*if(((orientation - rotation) != 2) || ((orientation - rotation) != -2)){
        if(player.shMetromino == 1){
        }
        else{
            let new_x = (((orientation == 0) && (rotation == 1)) || ((orientation == 2) && (rotation == 1)) || 
                         ((orientation == 3) && (rotation == 0)) || ((orientation == 3) && (rotation == 2))) ? 
                            -1 : 1;
        
            if(!collision(new_x, y, rotation)){
                player.pos.x = new_x;
                return 1;
            }
            if(!collision(new_x, (y - 1), rotation)){
                player.pos.y = y;
                return 1;
            }
            if(!collision(x, (y + 2), rotation)){
                player.pos.y += 2;
                return 1;
            }
            if(!collision(new_x, (y + 2), rotation)){
                player.pos.y += 2;
                return 1;
            }
        }
    }*/

    let new_x_1 = x + 1;
    let new_x_2 = x - 1;
    if(x > 5){
        new_x_1 = x - 1;
        new_x_2 = x + 1;
    }

    player.lastSpin = (player.shMetromino == 2)? 1 : 0;

    if(!collision(new_x_1, y, rotation)){
        player.pos.x = new_x_1;
        return 1;
    }
    if(!collision(new_x_2, y, rotation)){
        player.pos.x = new_x_2;
        return 1;
    }

    // 180° spins
    if(((orientation - rotation) == 2) || ((orientation - rotation) == -2)){
        //check if above is a valid spot
        if(!collision(x, (y - 1), rotation)){
            player.pos.y--;
            return 1;
        }
        if(kickCheck(new_x_1, (y + 1), rotation) ||
          (collision(x, (y - 1), orientation) && kickCheck(new_x_1, (y + 2), rotation)))
            return 1;
            
        if(kickCheck(new_x_2, (y + 1), rotation) ||
          (collision(x, (y - 1), orientation) && kickCheck(new_x_2, (y + 2), rotation)))
            return 1;
    }

    // 90° spins
    else{ 
        if(kickCheck(new_x_1, (y + 1), rotation) ||
          (collision(x, (y - 1), orientation) && kickCheck(new_x_1, (y + 2), rotation)))
            return 1;
        
        if(kickCheck(new_x_2, (y + 1), rotation) ||
          (collision(x, (y - 1), orientation) && kickCheck(new_x_2, (y + 2), rotation)))
            return 1;
        
        //check if above is a valid spot
        if(!collision(x, (y - 1), rotation)){
            player.pos.y--;
            return 1;
        }
    }

    if(kickCheck(new_x_1, (y - 1), rotation) ||
      kickCheck(new_x_2, (y - 1), rotation))
        return 1;

    if(!collision(x, (y - 2), rotation)){
        player.pos.y -= 2;
        return 1;
    }
    if(kickCheck(new_x_1, (y - 2), rotation) ||
      kickCheck(new_x_2, (y - 2), rotation))
        return 1; 
    

    return 0;
}

function kickCheck(new_x, y, rotation){
    if(!collision(new_x, y, rotation)){
        player.pos.x = new_x;
        player.pos.y = y;
        return 1;
    }
    return 0;
}

function collision(x, y, rotate){
    if(!player.shMetromino)
        rotate = 0;

    let size = shMetrominos[player.shMetromino][player.orientation].length;
    for(let i = 0; i < size; i++){
        let n = shMetrominos[player.shMetromino][rotate][i].length;
        for(let j = 0; j < n; j++)
            if(shMetrominos[player.shMetromino][rotate][i][j] && 
              (( ((x + j > 9) || (x + j < 0)) || ((y + i > 21) || (y + i < 0)) ) || board.state[y + i][x + j]))
                return 1;
    }
    return 0;
}

function place(){
    if(!collision(player.pos.x, (player.pos.y + 1), player.orientation))
        return;

    let x = player.pos.x;
    let y = player.pos.y;
    let size = shMetrominos[player.shMetromino][player.orientation].length;
    for(let i = 0; i < size; i++){
        let n = shMetrominos[player.shMetromino][player.orientation][i].length;
        for(let j = 0; j < n; j++)
            if(shMetrominos[player.shMetromino][player.orientation][i][j] && 
              (( ((x + j > 9) || (x + j < 0)) || ((y + i > 21) || (y + i < 0)) ) || !board.state[y + i][x + j]))
                board.state[y + i][x + j] = player.shMetromino + 1;
    }
    clearLines();
    nextPiece();
    gameOver(0);
}

function clearLines(){
    let lines = Array.from(Array(22).fill(0));

    let i = 10;
    while(i--){
        lines[0]  += board.state[0][i]  ?  1 : 0;
        lines[1]  += board.state[1][i]  ?  1 : 0;
        lines[2]  += board.state[2][i]  ?  1 : 0;
        lines[3]  += board.state[3][i]  ?  1 : 0;
        lines[4]  += board.state[4][i]  ?  1 : 0;
        lines[5]  += board.state[5][i]  ?  1 : 0;
        lines[6]  += board.state[6][i]  ?  1 : 0;
        lines[7]  += board.state[7][i]  ?  1 : 0;
        lines[8]  += board.state[8][i]  ?  1 : 0;
        lines[9]  += board.state[9][i]  ?  1 : 0;
        lines[10] += board.state[10][i] ?  1 : 0;
        lines[11] += board.state[11][i] ?  1 : 0;
        lines[12] += board.state[12][i] ?  1 : 0;
        lines[13] += board.state[13][i] ?  1 : 0;
        lines[14] += board.state[14][i] ?  1 : 0;
        lines[15] += board.state[15][i] ?  1 : 0;
        lines[16] += board.state[16][i] ?  1 : 0;
        lines[17] += board.state[17][i] ?  1 : 0;
        lines[18] += board.state[18][i] ?  1 : 0;
        lines[19] += board.state[19][i] ?  1 : 0;
        lines[20] += board.state[20][i] ?  1 : 0;
        lines[21] += board.state[21][i] ?  1 : 0;
    }

    i = 22;
    let j = 4;
    let cleared = [];
    while(i--){
        if(!lines[i])
            break;

        else if(lines[i] == 10){
            cleared.push(i);
            
            j--;
            if(!j){
                i--;
                break;
            }
        }
        else if(j != 4){
            j--;
            if(!j)
                break;
        }
    }

    let perfectClear = ((cleared.length + i) == 21) && !lines[i];

    if(cleared.length){
        getScore(cleared.length, perfectClear);
        i = cleared.length;
        while(i--){
            board.state.splice(cleared[i], 1);
            board.state.unshift(Array.from(Array(10).fill(0)));
        }
        levelUp(cleared.length);
    }
}

function levelUp(cleared){
    if(game.state.leveling && ((game.stats.cleared[0] % 10) < cleared) && 
      (game.stats.level < 19) && (game.stats.level > 0)){
        game.stats.level++;
        let level = document.querySelector("div:has(>.info):nth-child(1) .info:nth-child(2) b");
        level.innerHTML = game.stats.level;
    }
}







// shMetromino handling

function shuffleBag(){
    let iterations = game.shMetrominos.sevenBag? 10 : 5;  // nice
    while(iterations--){
        let size = game.shMetrominos.sevenBag? [0, 1, 2, 3, 4, 5, 6] : 
            [0, 6, 1, 5, 2, 4, 3, 2, 4, 1, 5, 0, 6];
        while(size.length){
            let index = Math.floor(Math.random() * size.length);
            game.shMetrominos.bag.push(size.splice(index, 1)[0]);
        }
    }

    game.shMetrominos.bagIndex = 5;
    game.shMetrominos.next = game.shMetrominos.bag.slice(0, 5);

    drawNextAndHolding(next_ctx, game.shMetrominos.next[0]);
    drawComing();
}

function nextPiece(){
    let next = game.shMetrominos.next.shift();
    player.pos.x = (!next)? 4 : 3;
    player.pos.y = 0;
    player.shMetromino = next;
    player.orientation = 0;
    player.swapped = false;

    game.shMetrominos.next.push(game.shMetrominos.bag[game.shMetrominos.bagIndex]);
    game.shMetrominos.bagIndex = (game.shMetrominos.bagIndex + 1) % 70;

    drawBoard();
    drawNextAndHolding(next_ctx, game.shMetrominos.next[0]);
    drawComing();
}

function swapHolding(){
    if(player.swapped)
        return;

    if(player.holding == -1){
        player.holding = player.shMetromino;
        nextPiece();
        player.swapped = true;
    }
    else{
        let holding = player.holding;
        player.holding = player.shMetromino;
        player.shMetromino = holding;
        player.swapped = true;
    }

    player.pos.x = (!next)? 4 : 3;
    player.pos.y = 0;
    player.orientation = 0;
    drawBoard();
    drawNextAndHolding(holding_ctx, player.holding);
}










// all graphical stuff on the canvasses

function drawGrid(){
    let boardGrid = document.getElementById("board");
    
    let i = 200;
    while(i--){
        let cell = document.createElement("div");
        boardGrid.appendChild(cell).className = "grid-cells";
    };
}

function drawBoard(){
    board.ctx.clearRect(0, 0, board.info.width, board.info.height);

    let y = 22;
    while(y--){
        let x = 10;
        while(x--){
            if(board.state[y][x]){
                board.ctx.fillStyle = colours[board.state[y][x]];
                board.ctx.fillRect((x * board.info.cellSize), (y * board.info.cellSize), board.info.cellSize, board.info.cellSize);
            }
        }
    }
    drawCurrent();
}

function drawCurrent(){
    board.ctx.fillStyle = colours[player.shMetromino + 1];
    let shMetromino = shMetrominos[player.shMetromino][player.orientation];

    let size = shMetromino.length;
    for(let y = 0; y < size; y++)
        for(let x = 0; x < size; x++)
            if(shMetromino[x][y])
                board.ctx.fillRect(((y * board.info.cellSize) + (player.pos.x * board.info.cellSize)), ((x * board.info.cellSize) + (player.pos.y * board.info.cellSize)), board.info.cellSize, board.info.cellSize);
}

function drawNextAndHolding(context, piece){
    context.clearRect(0, 0, 168, 168);

    context.fillStyle = colours[piece + 1];

    let shMetromino = shMetrominos[piece][0];
    let start_x = (piece > 1)? 
                   21 : (!piece)? 
                        42 : 0;

    let size = shMetromino.length;
    for(let y = 0; y < size; y++)
        for(let x = 0; x < size; x++)
            if(shMetromino[y][x])
                context.fillRect(((start_x + (x * 42))), (21 + (y * 42)), 42, 42);
}

function drawComing(){
    coming_ctx.clearRect(0, 0, 96, 432);

    let start_y = 348;
    let bagSize = 4;
    while(bagSize--){
        let piece = game.shMetrominos.next[bagSize + 1];
        coming_ctx.fillStyle = colours[piece + 1];
        let shMetromino = shMetrominos[piece][0];
        let start_x = (piece > 1)? 
                       10 : (!piece)? 
                            22 : 0;

        let size = shMetromino.length;
        for(let y = 0; y < size; y++)
            for(let x = 0; x < size; x++)
                if(shMetromino[y][x])
                    coming_ctx.fillRect(((start_x + (x * 26))), (start_y + (y * 22)), 26, 22);

        start_y -= 104;
    }
}










// score

function getScore(cleared, perfectClear){    
    if(!game.stats.level)
        return;

    let level = game.stats.level / 2;
    let points = 0;
    let spin = player.lastSpin;

    if(!cleared){
        if(player.lastSpin){
            points = 50 * level;
            game.stats.score += points;
            player.lastSpin = 0;
        }
        return;
    }

    points = (cleared == 1) ?
        ( (100 * level * ((perfectClear * 2) + 1)) + ((spin * 2) * (150 * level)) ) : (cleared == 2) ?
        ( (300 * level * ((perfectClear * 2) + 1)) + ((spin * 2) * (250 * level)) ) : (cleared == 3) ?
        ( (500 * level * ((perfectClear * 2) + 1)) + ((spin * 2) * (400 * level)) ) : 
        ( (800 * level * ((perfectClear * 2) + 1)) );
    
    game.stats.score += points;
    let index = cleared + (spin * 4);
    updateScore(cleared, index, perfectClear);

    player.lastSpin = 0;
}

function updateScore(cleared, index, perfectClear){
    let score_select = document.getElementById("scoreDisplay");
    score_select.innerHTML = makeScoreDisplay();

    if(!cleared)
        return;

    game.stats.cleared[0] += cleared;
    score_select = document.querySelector("div:has(>.info):nth-child(2) .info:nth-child(1) b");
    score_select.innerHTML = game.stats.cleared[0];
    
    game.stats.cleared[index]++;
    score_select = document.querySelector("div:has(>.info):nth-child(2) .info:nth-child(" + (index + 1) + ") b");
    score_select.innerHTML = game.stats.cleared[index];

    if(perfectClear){
        game.stats.cleared[8]++;
        score_select = document.querySelector("div:has(>.info):nth-child(2) .info:nth-child(9) b");
        score_select.innerHTML = game.stats.cleared[8];
    }
}

function makeScoreDisplay(){
    i = 5;
    let displayString = "";
    let score = game.stats.score;
    while(score > 0){
        let segment = (score % 1000) + "";
        segment = (segment.length > 2)? segment :
                  ((segment.length > 1)? "0" : "00") + segment;

        displayString = ((i)? "," + segment : segment) + displayString;
        score = Math.floor(score / 1000);
        i--;
    }
    while(i--)
        displayString = ((i) ? ",000" : "000") + displayString;

    return displayString;
}

function clearScore(){
    let score_select = document.getElementById("scoreDisplay");
    game.stats.score = 0;
    score_select.innerHTML = "000,000,000,000,000";

    let i = 9;
    while(i--){
        game.stats.cleared[i] = 0;
        score_select = document.querySelector("div:has(>.info):nth-child(2) .info:nth-child(" + (i + 1) + ") b");
        score_select.innerHTML = 0;
    }
}










// timer

function startTime(){
    if(game.state.timed){
        game.time.timer = setInterval(displayCountDown, 20);
        displayCountDown();
        return;
    }
    game.time.timer = setInterval(displayPlayTime, 20);
    displayPlayTime();
}
  
function resetTime(){
    clearInterval(game.time.timer);
    if(game.state.timed){
        game.time.ms = 0;
        game.time.s = 60;
        game.time.min = 1;
        document.querySelector("#timerDisplay").innerHTML = "02 : 00 : 000";
    }
    else{
        game.time.ms = 0;
        game.time.s = 0;
        game.time.min = 0;
        document.querySelector("#timerDisplay").innerHTML = "00 : 00 : 000";
    }
}
  
// shows the playtime on screen
function displayPlayTime(){
    game.time.ms += 20;
    if(game.time.ms >= 1000){
        game.time.ms = 0;
        game.time.s++;
        if(game.time.s >= 60){
            game.time.s = 0;
            game.time.min++;
            if(game.time.min > 99){
                resetTime();
                startTime();
            }
        }
    }
    document.querySelector("#timerDisplay").innerHTML = makeTimeDisplay(false);
}

// shows the countdown
function displayCountDown(){
    if(!game.time.ms){
        if(!game.time.s){
            if(!game.time.min){
                gameOver(1);
                document.querySelector("#timerDisplay").innerHTML = "Time up!";
                return;
            }

            game.time.min--;
            game.time.s = 59;
        }

        game.time.s--;
        game.time.ms = 1000;
    }
    else
        game.time.ms -= 20;
    
    document.querySelector("#timerDisplay").innerHTML = makeTimeDisplay(true);
}
  
// returns a string containing the time as a display
function makeTimeDisplay(){
    if(game.state.timed){
        let milliseconds = displayTimerSegment((game.time.ms==1000)? 0 : (game.time.ms / 10));
        let seconds = displayTimerSegment(game.time.s);
        let minutes = displayTimerSegment(game.time.min);
        return minutes + " : " + seconds + " : " + milliseconds + "0";
    }

    let milliseconds = displayTimerSegment(game.time.ms/10);
    let seconds = displayTimerSegment(game.time.s);
    let minutes = displayTimerSegment(game.time.min);
    return minutes + " : " + seconds + " : " + milliseconds + "0";
}
  
// fills out empty digits with 0.
function displayTimerSegment(value){
    return (value < 10) ? ("0" + value) : value;
}
