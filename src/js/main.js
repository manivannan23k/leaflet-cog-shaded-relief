const {ShadedReliefLayer} = require('./layer.js');

const loadIndiaBoundary = (map) => {
    fetch('/ind.geojson')
    .then(r=>r.json())
    .then(r=>{
        L.geoJSON(r, {
            style: {
                "color": "#333333",
                "weight": 0.5,
                "opacity": 0.5,
                fillColor: '#000000',
                fillOpacity: 0,
            }
        }).addTo(map);
    });
}

async function init(){
    try{
        const map = L.map('map', {minZoom: 4, maxZoom: 12}).setView([22.442930, 78.117867], 5);
        loadIndiaBoundary(map);
        let layer = new ShadedReliefLayer({
            url: "https://storage.googleapis.com/gis-projects-poc-output/bathymetry_cog.tif",
            interpolation: 'nearestNeighbour',
            samplingRatio: 2,
            imageSmoothing: true,
            debug: true,
            min: -10000,
            max: 7000,
            maxZoom: 10
        });
        layer.addTo(map);
    }catch(e){
        console.log(e);
    }
}
init()