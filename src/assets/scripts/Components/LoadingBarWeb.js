/**
 * Loading Bar
 * @param {object} opt 
 */
module.exports = (opt) => {
    opt = opt || {};

    const surface = Module.getSurface();
    const scene = surface.getScene();

    const { mat4, vec3 } = Module.require('assets/gl-matrix.js');
    const Animations = Module.require("assets/Animations.js")();

    const uniq = () => {
        return Math.floor(Math.random() * Date.now())
    }

    function toBase64(arr) {
        //arr = new Uint8Array(arr) if it's an ArrayBuffer
        return btoa(
           arr.reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
     }

    var options = {
        anchor: opt.anchor || [0.5, 0, 0],
        position: opt.position || [0, 50, 0],
        anchorImage: opt.anchorImage || [0.5, 0.5, 0],
        positionImage: opt.positionImage || [0, 0, 0],
        pivot: opt.pivot || [0, 0, 0],
        rotate: opt.rotate || [0, 0, 0],
        scale: opt.scale || [2, .05, 1],
        percentage: (typeof opt.percentage === "number") ? opt.percentage : 0.5,
    }

    var id = String(uniq());
    var id2 = String(uniq()+10);

    let proto = {};

    var loadingBar;
    var heroshot;
    // props
    let visible = (typeof opt.visible === "boolean") ? opt.visible : true;

    // main matrix
    var m = mat4.create();
    var pixelDensity = (Module.pixelDensity != undefined) ? Module.pixelDensity : 1;

    // axis
    var axisX = vec3.fromValues(1, 0, 0);
    var axisY = vec3.fromValues(0, 1, 0);
    var axisZ = vec3.fromValues(0, 0, 1);

    let css_dom = document.createElement("style"); css_dom.id = "css_loader_dom";
    let cbody = document.createElement("div"); cbody.classList.add('c_body');
    let c1 = document.createElement("div"); c1.classList.add('c_1');
    let c2 = document.createElement("div"); c2.classList.add('c_2');
    let c3 = document.createElement("div"); c3.classList.add('c_3');
    let c4 = document.createElement("div"); c4.classList.add('c_4');
    let ctext = document.createElement("div"); ctext.classList.add('c_text');
    let ctext1 = document.createElement("div"); ctext1.classList.add('c_text_1');
    let ctext2 = document.createElement("div"); ctext2.classList.add('c_text_2');
    let cbar = document.createElement("div"); cbar.classList.add('c_bar');
    let cinnerbar = document.createElement("div"); cinnerbar.classList.add('c_inner_bar');

    const initHero = ()=>{
        // Module.addEventListener("onSurfaceChanged", onSurfaceChanged);

        // heroshot = scene.addObject(id2, "assets/square.c3b");
        // heroshot.setParameter(1, "opacity_ratio", 0);
        // heroshot.setParameter(0, "opacity_ratio", 0);
        // heroshot.setParameter("hud", true);
        // heroshot.setParameter("hud_alignment", options.anchorImage[0], options.anchorImage[1], options.anchorImage[2]);

        // onSurfaceChanged(0, Module.screen.width, Module.screen.height);
    }

    let init = () => {
        initHero();

        let css = `
            .c_body {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                padding: 1em;
                box-sizing: border-box;
                overflow: hidden;
                color: white;
                background: black;
                transition: all linear 500ms;
                z-index: 10000;
            }
            .c_1 {
                position: relative;
                max-width: 500px;
                margin: 0 auto;
                height: 100%;
            }
            
            .c_2 {
                width: 100%;
                height: calc(100% - 3em);
                background-size:contain;
                background-position:center;
                background-repeat:no-repeat;
                box-sizing: border-box;
                padding: 1em 0em;
                background-origin: content-box;
                transition: all linear 250ms;
                opacity:0;
            }
            
            .c_3 {
                width: 100%;
                height : 3em;
            }
            
            .c_4 {
                max-width: 250px;
                margin: 0 auto;
                padding: 0.5em 0;
            }
            
            .c_text
            {
                font-size: 0.75em;
                margin-bottom:0.5em;
                font-family: "Arial";
                width:100%;
                display: flex;
            }
            
            .c_text_1
            {
                flex: 50%;
            }
            
            .c_text_2
            {
                flex: 50%;
                text-align: right;
            }
            .c_bar {
                position: relative;
                width: 100%;
                background: #444;
                height: 0.5em;
                overflow:hidden;
                border: 1px solid #444; /* some kind of blue border */
                border-radius: 4px;
                box-shadow: 0px 0px 1px #FFF;
            }
            
            .c_inner_bar {
                position: absolute;
                top:0;
                left: 0;
                width: 0%;
                height: 100%;
                background: #00cadf;
                transition: all linear 250ms;
            }
        `;        

        css_dom.innerHTML = css;
        Module.canvas.parentElement.append(css_dom);

        cbody.append(c1);
        c1.append(c2);
        c1.append(c3);
        c3.append(c4);

        c4.append(ctext);
        ctext.append(ctext1); ctext1.innerHTML = "INITIALISING"
        ctext.append(ctext2);
        c4.append(cbar);
        cbar.append(cinnerbar);

        Module.canvas.parentElement.append(cbody);
    }

    // init
    init();

    Object.defineProperties(proto, {
        visible: {
            get: () => { return visible; },
            set: (v) => {
                
            }
        },
        percentage: {
            get: () => { return options.percentage; },
            set: (v) => {
                options.percentage = v;
                let perc = Math.round(v*100);
                cinnerbar.style.width = perc + "%";

                ctext2.innerHTML = perc + " %";
            }
        },

        label: {
            get: () => { return ctext1.innerText},
            set: (v) => {
                ctext1.innerHTML = v;
            }
        }
    })

    return Object.assign(proto, {
        isNull: ()=> {
         return false;
        },
        remove: ()=> {
            cbody.style.opacity = "0";
            cbody.style.pointerEvents = "none";
            setTimeout(() => {
                try {
                    Module.canvas.parentElement.removeChild(cbody);
                    Module.canvas.parentElement.removeChild(css_dom);
                } catch (error) {
                    
                }
                
            }, 500);
            return true;
        },
        setHeroShot: (imgbuffer)=>{
            if (imgbuffer){
                c2.style.backgroundImage = `url(data:image/png;base64,${toBase64(new Uint8Array(imgbuffer))})`
            } else {
                var contents = Module.FS.readFile('assets/poweredby.png', { encoding: 'binary' });
                c2.style.backgroundImage = `url(data:image/png;base64,${toBase64(new Uint8Array(contents))})`
            }

            c2.style.opacity = "1";
        },

        toggleHeroShot: (bool)=>{
            // not used
        }
    })
}