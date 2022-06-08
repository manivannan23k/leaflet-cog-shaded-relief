const Utils = {
    getData: function(url){
        return new Promise((resolve, reject) => {
            const oReq = new XMLHttpRequest();
            oReq.open("GET", url, true);
            oReq.responseType = "arraybuffer";
            oReq.onload = function (oEvent) {
                const arrayBuffer = oReq.response;
                if (arrayBuffer) {
                    const byteArray = new Uint8Array(arrayBuffer);
                    const message = RasterFloatProto.decode(byteArray);
                    const object = RasterFloatProto.toObject(message);
                    object.data = buffer.Buffer.from(object.data, "base64");
                    object.data = buffer.Buffer.from(pako.inflate(new Uint8Array(object.data)));
                    object.factor = factor;
                    resolve(object)
                }else{
                    reject(null)
                }
            };
            oReq.send(null);
        })
    },
    processData: function (data) {
        data.rasterData = [];
        data.min = NaN;
        data.max = NaN;
        for (let y = 0; y < data.ny; y++) {
            data.rasterData[y] = [];
            for (let x = 0; x < data.nx; x++) {
                if (data.dataType === "FLOAT32") {
                    data.rasterData[y][x] = data.data.readFloatLE(((y * data.nx) + x) * 4) / data.factor;
                } else {
                    data.rasterData[y][x] = data.data.readInt16LE(((y * data.nx) + x) * 2) / data.factor;
                }
                if (isNaN(data.min) || data.min > data.rasterData[y][x])
                    data.min = data.rasterData[y][x];
                if (isNaN(data.max) || data.max < data.rasterData[y][x])
                    data.max = data.rasterData[y][x];
            }
        }
        delete data.data;
        return data;
    },

    toLatLng: function (coords) {
        return proj4(proj4.defs('EPSG:3857'), proj4.defs('EPSG:4326'), coords);
    },

    toLatLngBbox: function (bbox) {
        const p1 = Utils.toLatLng([bbox[0], bbox[1]]);
        const p2 = Utils.toLatLng([bbox[2], bbox[3]]);
        return [...p1, ...p2];
    },

    toWebMer: function (coords) {
        return proj4(proj4.defs('EPSG:4326'), proj4.defs('EPSG:3857'), coords);
    },

    toWebMerBbox: function (bbox) {
        const p1 = Utils.toWebMer([bbox[0], bbox[1]]);
        const p2 = Utils.toWebMer([bbox[2], bbox[3]]);
        return [...p1, ...p2];
    },

    tileToLatLngBbox: function (x, y, z) {
        const lng1 = (x / Math.pow(2, z) * 360 - 180);
        const lng2 = ((x + 1) / Math.pow(2, z) * 360 - 180)
        const n1 = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
        const n2 = Math.PI - 2 * Math.PI * (y + 1) / Math.pow(2, z);
        const lat1 = ((180 / Math.PI * Math.atan(0.5 * (Math.exp(n1) - Math.exp(-n1)))));
        const lat2 = ((180 / Math.PI * Math.atan(0.5 * (Math.exp(n2) - Math.exp(-n2)))));
        return [lng1, lat1, lng2, lat2]
    },

    isInsideData: function (data, box1) {
        switch (data['coordinateSystem']) {
            case 4326:
                box1 = Utils.toLatLngBbox(box1)
                break;
            case 3857:
                box1 = (box1)
                break;
            default:
                throw "Error: Unsupported CRS"
        }
        let box2 = [data.x1, data.y1, data.x2, data.y2];
        let aLeftOfB = box1[2] < box2[0];
        let aRightOfB = box1[0] > box2[2];
        let aAboveB = box1[3] > box2[1];
        let aBelowB = box1[1] < box2[3];

        return !(aLeftOfB || aRightOfB || aAboveB || aBelowB);
    },


    getColorAtRatio: function (startColor, endColor, ratio) {
        const w = ratio * 2 - 1;
        const w1 = (w + 1) / 2;
        const w2 = 1 - w1;
        return [Math.round(startColor[0] * w1 + endColor[0] * w2),
            Math.round(startColor[1] * w1 + endColor[1] * w2),
            Math.round(startColor[2] * w1 + endColor[2] * w2),
            Math.round((startColor[3] * w1 + endColor[3] * w2))];
    },
    componentToHex: function(c) {
        const hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    },
    rgbToHex: function(r, g, b, a) {
        return "#" + Utils.componentToHex(r) + Utils.componentToHex(g) + Utils.componentToHex(b) + Utils.componentToHex(a);
    },
    hexToRgb: function(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        let rgba = result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
            a: parseInt(result[4], 16)
        } : null;
        if (!rgba)
            return rgba;
        return [rgba.r, rgba.g, rgba.b, rgba.a]
    },

    getColor: function (colorRamp, value, min, max) {
        if (value === null) {
            return [0, 0, 0, 0];
        }
        try {
            colorRamp = colorRamp.map(v=>Utils.hexToRgb(v));
            const colorRampSize = colorRamp.length;
            const rampRatio = (1 / (colorRampSize - 1));
            const overAllRatio = (value - min) / (max - min);
            const index = Math.floor(overAllRatio / rampRatio);
            const startColor = colorRamp[index];
            const endColor = (index + 1) >= colorRamp.length ? colorRamp[index] : colorRamp[index + 1];
            const startColorX = index * rampRatio;//startColor[4]/100;
            const endColorX = (index + 1) * rampRatio;//endColor[4]/100;
            const localRatio = (overAllRatio - startColorX) / (endColorX - startColorX);
            return Utils.getColorAtRatio(endColor, startColor, localRatio);
        } catch (e) {
            return [0, 0, 0, 0]
        }
    },

    getDataIndexes: function (bbox, x, y, xRes, yRes, sampleTileRatio, coordinateSystem, x1, y1, _xRes, _yRes) {
        let lng, lat, coordinates = [0, 0];
        switch (coordinateSystem) {
            case 4326:
                coordinates = Utils.toLatLng([bbox[0] + x * xRes / sampleTileRatio, bbox[1] + y * yRes / sampleTileRatio]);
                break;
            case 3857:
                coordinates = ([bbox[0] + x * xRes / sampleTileRatio, bbox[1] + y * yRes / sampleTileRatio]);
                break;
            default:
                throw "Error: Unsupported CRS";
        }
        lng = coordinates[0];
        lat = coordinates[1];
        return [((lng - x1) / _xRes), ((lat - y1) / _yRes)];
    },

    drawTiles: function (coords, tile, size, data, samplePerTile, sampleTileRatio, colorRamp, interpolation, imageSmoothing, debug) {
        return new Promise(resolve => {
            const ctx = tile.getContext('2d');
            const bbox = Utils.toWebMerBbox(Utils.tileToLatLngBbox(coords.x, coords.y, coords.z));
            if (!Utils.isInsideData(data, bbox)) {
                if (debug) console.timeEnd(`TILE:${coords.x}/${coords.y}/${coords.z}`)
                return;
            }
            const xRes = (bbox[2] - bbox[0]) / samplePerTile;
            const yRes = (bbox[3] - bbox[1]) / samplePerTile;
            const width = samplePerTile,
                height = samplePerTile,
                buffer = new Uint8ClampedArray(width * height * 4);
            for (let y = 0; y < size.y; y += sampleTileRatio) {
                for (let x = 0; x < size.x; x += sampleTileRatio) {
                    let [xi, yi] = Utils.getDataIndexes(bbox, x, y, xRes, yRes, sampleTileRatio, data.coordinateSystem, data.x1, data.y1, data.xRes, data.yRes);
                    let v = 0;
                    if (xi <= 0 || yi <= 0 || xi >= data.nx || yi >= data.ny) {
                        v = null;
                    } else {
                        if (interpolation === "nearestNeighbour") {
                            v = Math.nearestNeighbour(data.rasterData, yi, xi);
                        }
                        if (interpolation === "bilinearInterpolation") {
                            v = Math.bilinearInterpolation(data.rasterData, yi, xi);
                        }
                        if (interpolation === 'bicubicInterpolation') {
                            if (xi < 2 || yi < 2 || xi >= data.nx - 2 || yi >= data.ny - 2) {
                                v = Math.nearestNeighbour(data.rasterData, yi, xi);
                            } else {
                                try {
                                    v = Math.bicubicInterpolation(data.rasterData, yi, xi);
                                } catch (e) {
                                    console.log(data.nx, data.ny, e)
                                }
                            }
                        }
                    }
                    v = Utils.getColor(colorRamp, v, data.min, data.max);
                    let pos = ((y / sampleTileRatio * samplePerTile) + x / sampleTileRatio) * 4;
                    buffer[pos] = v[0];
                    buffer[pos + 1] = v[1];
                    buffer[pos + 2] = v[2];
                    buffer[pos + 3] = v[3];
                }
            }
            const canvas = document.createElement('canvas'), ctxTemp = canvas.getContext('2d');
            canvas.width = width;
            canvas.height = height;
            const iData = ctxTemp.createImageData(width, height);
            iData.data.set(buffer);
            ctxTemp.imageSmoothingEnabled = false;
            // ctxTemp.imageSmoothingQuality = 'high';
            ctxTemp.putImageData(iData, 0, 0);

            ctx.imageSmoothingEnabled = imageSmoothing;
            ctx.imageSmoothingQuality = 'high';
            ctx.scale(sampleTileRatio, sampleTileRatio);
            ctx.drawImage(canvas, 0, 0);

            if (debug) console.timeEnd(`TILE:${coords.x}/${coords.y}/${coords.z}`)
            resolve(tile)
        })
    },

};

export default Utils;