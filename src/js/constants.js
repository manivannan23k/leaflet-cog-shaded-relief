import Utils from './utils';
let COLOUR_RAMPS = {
    "rainbow": 
    [
        [0, 0, 255, 150],
        [0, 125, 255, 150],
        [0, 255, 255, 150],
        [0, 255, 125, 150],
        [0, 255, 0, 150],
        [125, 255, 0, 150],
        [255, 255, 0, 150],
        [255, 125, 0, 150],
        [255, 0, 0, 150]
    ].map(v=>Utils.rgbToHex(v[0], v[1], v[2], v[3])),
    "water": [
        "#E2F5FF00",
        "#56C5FF88",
        "#56C5FFFF"
    ],
    "bwr": [
        "#457DC988",
        "#FFFFFF88",
        "#C95C4588"
    ],
    "ocean": [
        "#000050ff",
        "#001e64ff",
        "#003266ff",
        "#0052a5ff",
        "#87cefaff"
    ],
    "terrain": [
        "#006147ff",
        "#e8d67dff",
        "#821e1eff",
        "#cececeff",
        "#ffffffff"
    ]
};

export default {
    COLOUR_RAMPS
}