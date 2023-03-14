module.exports = () => {

    var EasingFunctions = {
        // no easing, no acceleration
        linear: function (t) { return t },
        // accelerating from zero velocity
        easeInQuad: function (t) { return t * t },
        // decelerating to zero velocity
        easeOutQuad: function (t) { return t * (2 - t) },
        // acceleration until halfway, then deceleration
        easeInOutQuad: function (t) { return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t },
        // accelerating from zero velocity
        easeInCubic: function (t) { return t * t * t },
        // decelerating to zero velocity
        easeOutCubic: function (t) { return (--t) * t * t + 1 },
        // acceleration until halfway, then deceleration
        easeInOutCubic: function (t) { return t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1 },
        // accelerating from zero velocity
        easeInQuart: function (t) { return t * t * t * t },
        // decelerating to zero velocity
        easeOutQuart: function (t) { return 1 - (--t) * t * t * t },
        // acceleration until halfway, then deceleration
        easeInOutQuart: function (t) { return t < .5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t },
        // accelerating from zero velocity
        easeInQuint: function (t) { return t * t * t * t * t },
        // decelerating to zero velocity
        easeOutQuint: function (t) { return 1 + (--t) * t * t * t * t },
        // acceleration until halfway, then deceleration
        easeInOutQuint: function (t) { return t < .5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t }
    }

    var setRequestId = (id, add)=>{
        if (!Module.animationids) Module.animationids = {};
        if (add) Module.animationids[id] = 1;
        else delete Module.animationids[id];
    }

    var getSessionType = ()=> {
        if (Module.xrSession) return Module.xrSession;
        
        return window;
    }

    var create = (opt) => {
        var opt = opt || {};
        var animation = {
            time: 0,    // percentage of time
            counter: 0, // loop counter
            start: undefined,
            req: undefined,

            state: "stopped",

            loop: opt.loop || 0,
            timing: opt.timing || EasingFunctions.linear,
            onDraw: opt.onDraw || undefined,
            onComplete: opt.onComplete || undefined,
            duration: opt.duration || 1,
            speed: opt.speed || 1,
        }

        if (animation.duration < 1) animation.duration = 1;

        var animate = (t) => {
            if (animation.state != "playing") {
                getSessionType().cancelAnimationFrame(animation.req);
                setRequestId(animation.req, false);
                return;
            }

            // t always starts at 0, using real ms timestamp instead
            var time = new Date().getTime();
            if (!animation.start) {
                if (animation.time != 0) animation.start = time - (animation.duration * animation.time);
                else animation.start = time;
            }
            // timeFraction goes from 0 to 1
            animation.time = (time - animation.start) / animation.duration;
            animation.time *= animation.speed;

            if (animation.time > 1) animation.time = 1;

            // calculate the current animation state
            let progress = animation.timing(animation.time);
            if (animation.onDraw) animation.onDraw(progress); // draw it

            if (animation.time == 1) {
                if (animation.loop == 0 || animation.loop == animation.counter) {
                    // finished
                    if (animation.onComplete) animation.onComplete(); // animation complete
                    getSessionType().cancelAnimationFrame(animation.req);
                    setRequestId(animation.req, false);
                    animation.state = "stopped";
                    animation.time = 0;    // percentage of time
                    animation.counter = 0; // loop counter
                }
                else {
                    animation.counter++;
                    animation.time = 0;
                    animation.start = undefined;
                    animation.req = getSessionType().requestAnimationFrame(animate);
                    setRequestId(animation.req, true);
                }
            } else {
                animation.req = getSessionType().requestAnimationFrame(animate);
                setRequestId(animation.req, true);
            }
        }

        var play = () => {
            animation.state = "playing";
            animation.start = undefined;
            animation.req = getSessionType().requestAnimationFrame(animate);
            setRequestId(animation.req, true);
        }

        var pause = () => {
            animation.state = "paused";
            getSessionType().cancelAnimationFrame(animation.req);
            setRequestId(animation.req, false);
        }

        var stop = () => {
            animation.state = "stopped";
            animation.time = 0;    // percentage of time
            animation.counter = 0; // loop counter
            getSessionType().cancelAnimationFrame(animation.req);
            setRequestId(animation.req, false);
        }

        var setPos = (pos) => { // 0 - 1 (percentage)
            getSessionType().cancelAnimationFrame(animation.req);
            setRequestId(animation.req, false);
            animation.start = undefined;
            animation.time = Number(pos);
            animation.state = "paused";
            if (animation.onDraw) animation.onDraw(pos); // draw it
        }

        var setTiming = (timing) => { // 0 - 1 (percentage)
            animation.timing = timing;
        }

        var setSpeed = (speed) => { // 0 - 1 normal 
            animation.speed = speed;
        }

        return Object.assign({
            play: play,
            pause: pause,
            stop: stop,
            setPos: setPos,
            setTiming: setTiming,
            setSpeed: setSpeed,
            getPos: () => { return animation.time; },
            getState: () => { return animation.state; },
            setDuration: (ms) => { animation.duration = ms; },
        })
    }

    return Object.assign({
        create: create,
        timing: EasingFunctions,
    })
}