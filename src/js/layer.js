const L = require('leaflet');
const GeoTIFF = require('geotiff');
import Utils from './utils';
import MathInterpolations from './math.interpolations';
import Constants from './constants';

let COLOUR_RAMPS = Constants.COLOUR_RAMPS;

const ShadedReliefLayer = L.GridLayer.extend({

    initialize: async function (options) {
        MathInterpolations()
        this.pendingTiles = []

        this.sampleTileRatio = 4
        this.imageSmoothing = false
        this.interpolation = "nearestNeighbour"
        this.debug = false;
        this.min = NaN;
        this.max = NaN;

        
        if (options) {
            if (options.colorRamp)
                this.colorRamp = options.colorRamp;
            if (options['interpolation'])
                this.interpolation = options['interpolation']
            if (options['samplingRatio'])
                this.sampleTileRatio = options['samplingRatio'];
            if (options['imageSmoothing'])
                this.imageSmoothing = options['imageSmoothing'];
            if (options['debug'])
                this.debug = options['debug'];
            if (options['min'])
                this.min = options['min'];
            if (options['max'])
                this.max = options['max'];
            if (options['url'])
                this.url = options['url'];

        }
        this.url = options.url;
        if(!this.colorRamp)
            this.colorRamp = COLOUR_RAMPS['rainbow'];
        this.samplePerTile = 256 / this.sampleTileRatio;

        L.Util.setOptions(this, options);
        this.tiff = await GeoTIFF.fromUrls(this.url, [
            "https://storage.googleapis.com/gis-projects-poc-output/bathymetry_cog.tif.ovr"
        ]);
        this.image = await this.tiff.getImage();
        
        let image = this.image;
        const imageBox = image.getBoundingBox();
        this.data = {};
        this.data.x1 = imageBox[0];
        this.data.y1 = imageBox[3];
        this.data.x2 = imageBox[2];
        this.data.y2 = imageBox[1];
        this.data.xRes = image.getResolution()[0];
        this.data.yRes = image.getResolution()[1];
        this.data.nx = image.getWidth();
        this.data.ny = image.getHeight();
        this.data.min = this.min;
        this.data.max = this.max;
            
        if(this.pendingTiles.length>0){
            for(let i=0;i<this.pendingTiles.length;i++){
                this.drawTile(this.pendingTiles[i].tile, this.pendingTiles[i].size, this.image, this.colorRamp, this.pendingTiles[i].coords, this.data, this.sampleTileRatio, this.samplePerTile, this.interpolation, this.imageSmoothing, this.tiff).then(t=>this.pendingTiles[i].done(null, t));
            }
        }        
    },

    createTile: function (coords, done) {
        const tile = L.DomUtil.create('canvas', 'leaflet-tile');
        const size = this.getTileSize();
        tile.width = size.x;
        tile.height = size.y;

        if(!this.image){
            this.pendingTiles.push({
                tile: tile,
                size: size,
                coords: coords,
                done: done
            });
            return tile
        }

        this.drawTile(tile, size, this.image, this.colorRamp, coords, this.data, this.sampleTileRatio, this.samplePerTile, this.interpolation, this.imageSmoothing, this.tiff).then(t=>done(null, t));
        return tile;
    },

    drawTile: function(tile, size, image, colorRamp, coords, data, sampleTileRatio, samplePerTile, interpolation, imageSmoothing, tiff){
        return new Promise((resolve, reject) => {
            // let image = this.image;
            // let colorRamp = this.colorRamp;
            let bbox = (Utils.tileToLatLngBbox(coords.x, coords.y, coords.z));
            let {x1, y1, x2, y2, xRes, yRes, nx, ny} = data;
            let rasterOptions = {};
            if (bbox) {
                rasterOptions["window"] = [
                    Math.round((bbox[0] - x1) / xRes) - 2,
                    Math.round((bbox[1] - y1) / yRes) - 2,
                    Math.round((bbox[2] - x1) / xRes) + 2,
                    Math.round((bbox[3] - y1) / yRes) + 2,
                ];
                if (rasterOptions["window"][0]<0){
                    rasterOptions["window"][0] = 0
                }
                if (rasterOptions["window"][1]<0){
                    rasterOptions["window"][1] = 0
                }
                if (rasterOptions["window"][2]>nx){
                    rasterOptions["window"][2] = nx
                }
                if (rasterOptions["window"][3]>ny){
                    rasterOptions["window"][3] = ny
                }
                x1 = bbox[0];
                y1 = bbox[1];
                x2 = bbox[2];
                y2 = bbox[3];
                nx = Math.abs(rasterOptions["window"][0] - rasterOptions["window"][2]);
                ny = Math.abs(rasterOptions["window"][1] - rasterOptions["window"][3]);;
            }
            
            let resolution = 0.0025;
            switch(coords.z){
                case 0:
                    resolution = 1
                    break;
                case 1:
                    resolution = 0.8
                    break;
                case 2:
                    resolution = 0.8
                    break;
                case 3:
                    resolution = 0.4
                    break;
                case 4:
                    resolution = 0.2
                    break;
                case 5:
                    resolution = 0.1
                    break;
                case 6:
                    resolution = 0.05
                    break;
                case 7:
                    resolution = 0.02
                    break;
                case 8:
                    resolution = 0.01
                    break;
                case 9:
                    resolution = 0.005
                    break;
                default:
                    resolution = 0.0025
                    break;
            }
            
            tiff.readRasters({
                bbox: [bbox[0]-resolution, bbox[3]-resolution, bbox[2]+resolution, bbox[1]+resolution] , resX : resolution, resY : resolution
            }).then(bands=>{
                let [ band ] = bands;
                const ctx = tile.getContext('2d');
                const width = samplePerTile,
                    height = samplePerTile,
                    buffer = new Uint8ClampedArray(width * height * 4);
                
                let aResolutionX = (2 * resolution + bbox[2] - bbox[0])/bands.width, aResolutionY = (2 * resolution + bbox[3] - bbox[1])/bands.height;
                let paddingX = Math.abs(((bbox[2] - bbox[0])/aResolutionX) - (bands.width))/2,
                    paddingY = Math.abs(((bbox[3] - bbox[1])/aResolutionY) - (bands.height))/2;
                
                let rasterData = [];

                for(let j=0;j<bands.height;j++){
                    rasterData[j] = [];
                    for(let i=0;i<bands.width;i++){
                        rasterData[j][i] = band[j*bands.height + i];
                    }
                }
                for (let y = 0; y < bands.height; y++) {
                    rasterData[y] = [];
                    for (let x = 0; x < bands.width; x++) {
                        rasterData[y][x] = band[((y * bands.width) + x)]
                        if (isNaN(data.min) || data.min > rasterData[y][x])
                            data.min = rasterData[y][x];
                        if (isNaN(data.max) || data.max < rasterData[y][x])
                            data.max = rasterData[y][x];
                    }
                }

                const [_x1, _y1, _x2, _y2] = Utils.toWebMerBbox(Utils.tileToLatLngBbox(coords.x, coords.y, coords.z));
                const vert = 2;
                const dp = ((_x2 - _x1) / bands.width + Math.abs(_y1 - _y2) / bands.height); //30 * 2;
                const twoPi = 2 * Math.PI;
                const halfPi = Math.PI / 2;
                const sunEl = (Math.PI * 45) / 180;
                const sunAz = (Math.PI * 135) / 180;
                const cosSunEl = Math.cos(sunEl);
                const sinSunEl = Math.sin(sunEl);
                let z0,
                    z1,
                    dzdx,
                    dzdy,
                    slope,
                    aspect,
                    cosIncidence;

                for (let y = 0; y < size.y; y += sampleTileRatio) {
                    for (let x = 0; x < size.x; x += sampleTileRatio) {

                        let xi = paddingX + x/size.x * (bands.width - 4) + 2;
                        let yi = paddingY + y/size.y * (bands.height - 4) + 2;

                        let v = 0;
                        v = Math.nearestNeighbour(rasterData, yi, xi);

                        z0 = vert * Math.nearestNeighbour(rasterData, yi, xi + 1);
                        z1 = vert * Math.nearestNeighbour(rasterData, yi, xi - 1);
                        dzdx = (z1 - z0) / dp;
                        z0 = vert * Math.nearestNeighbour(rasterData, yi - 1, xi);
                        z1 = vert * Math.nearestNeighbour(rasterData, yi + 1, xi);
                        dzdy = (z1 - z0) / dp;
                        slope = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy));
                        aspect = Math.atan2(dzdy, -dzdx);
                        if (aspect < 0) {
                            aspect = halfPi - aspect;
                        } else if (aspect > halfPi) {
                            aspect = twoPi - aspect + halfPi;
                        } else {
                            aspect = halfPi - aspect;
                        }
                        cosIncidence = sinSunEl * Math.cos(slope) + cosSunEl * Math.sin(slope) * Math.cos(sunAz - aspect);
                        let shaded = cosIncidence * 255;

                        if(v<0){
                            v = Utils.getColor(COLOUR_RAMPS.ocean, v, data.min, 0);
                        }else{
                            v = Utils.getColor(COLOUR_RAMPS.terrain, v, 0, data.max);
                        }

                        let pos = ((y / sampleTileRatio * samplePerTile) + x / sampleTileRatio) * 4;
                        buffer[pos] = Math.floor((v[0] + 2 * shaded)/3);
                        buffer[pos + 1] = Math.floor((v[1] +  2*shaded )/3);
                        buffer[pos + 2] = Math.floor((v[2] +  2*shaded )/3);
                        buffer[pos + 3] = 255;
                    }
                }

                const canvas = document.createElement('canvas'), ctxTemp = canvas.getContext('2d');
                canvas.width = width;
                canvas.height = height;
                const iData = ctxTemp.createImageData(width, height);
                iData.data.set(buffer);
                ctxTemp.imageSmoothingEnabled = false;
                ctxTemp.putImageData(iData, 0, 0);

                ctx.imageSmoothingEnabled = imageSmoothing;
                ctx.imageSmoothingQuality = 'low';
                ctx.scale(sampleTileRatio, sampleTileRatio);
                ctx.drawImage(canvas, 0, 0);
                resolve(tile);
            });
        })
    }

});

export {ShadedReliefLayer};