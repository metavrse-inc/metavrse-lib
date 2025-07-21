module.exports = class HavokVisualDebugger {
    hk;
    world;
    bodies; // caller keeps this in‑sync

    enabled = false;
    colours = { 
        "static": [0.0, 1, 0.0, 1.0],
        "dynamic": [1.0, 0.2, 0.2, 1.0],
        "kinematic": [0.2, 1.0, 0.2, 1.0],
        "constraint": [0.2, 0.2, 1.0, 1.0],
        "contact": [1.0, 1.0, 0.2, 1.0]
    };
    
    lastFrame = { lines: [], timestamp: 0 };

    constructor(hk, world, bodies) {
        this.hk = hk;
        this.world = world;
        this.bodies = bodies;
    }

    /** Toggle debug capture. */
    setEnabled(value) { this.enabled = value; }
    isEnabled() { return this.enabled; }

    /**
     * Pull fresh wire‑frame lines from Havok.  Expensive – only call once per
     * render update when enabled === true.
     */
    extract(b) {
        // if (!this.enabled) {
        //     return this.lastFrame;
        // }

        const lines = [];

        this.extractRigidBodies(b, lines);
        // TODO: this.extractConstraints(lines);
        // TODO: this.extractContacts(lines);

        this.lastFrame = { lines, timestamp: Date.now() };
        return this.lastFrame;
    }

    /***********************************
     * RIGID‑BODY VISUALISATION        *
     ***********************************/

    extractRigidBodies(b, out) {
        // hp.HP_World_GetNumBodies(world) -> [Result, number]
        // const [res, num] = this.hk.HP_World_GetNumBodies(this.world);
        // if (res !== this.hk.Result.RESULT_OK) {
        //     console.warn("HP_World_GetNumBodies failed", res);
        //     return;
        // }

        // for (let i = 0; i < num; ++i) {
        for (var [key, obj] of b) {
            // const body = this.bodies[i];
            if (!obj || !obj.RigidBody) continue;

            if (obj.visible != undefined && !obj.visible) continue;

            let bodies = [obj.RigidBody.body];
            
            if (obj.RaycastVehicle) {
                for (var wheel of obj.RaycastVehicle.wheels)
                {
                    bodies.push(wheel.bodyId)
                }

                for (var wheel of obj.RaycastVehicle.axles)
                {
                    bodies.push(wheel.bodyId)
                }
            }

            for (var body of bodies)
            {
                // const body = obj.RigidBody.body;
                if (!body) continue;


                // Get body transform (world space)
                const [trRes, qTransform] = this.hk.HP_Body_GetQTransform(body);
                if (trRes !== this.hk.Result.RESULT_OK) continue;
                const [pos, rot] = qTransform;

                // Motion type → colour bucket
                const [mtRes, motion] = this.hk.HP_Body_GetMotionType(body);
                if (mtRes !== this.hk.Result.RESULT_OK) continue;

                let colourCat = "static";
                switch (motion) {
                    case this.hk.MotionType.DYNAMIC:   colourCat = "dynamic";   break;
                    case this.hk.MotionType.KINEMATIC: colourCat = "kinematic"; break;
                }
                const colour = this.colours[colourCat];

                // Shape handle
                const [shapeRes, shape] = this.hk.HP_Body_GetShape(body);
                if (shapeRes !== this.hk.Result.RESULT_OK) continue;

                this.drawShapeWireframe(shape, pos, rot, colour, out);

            }

        }
    }

    /**
     * Builds a wire‑frame for the given shape by asking Havok to generate a
     * triangle mesh, which we then convert to edge lines.
     */
    drawShapeWireframe(
        shape,
        pos,
        rot,
        colour,
        out,
    ) {
        // hp.HP_Shape_CreateDebugDisplayGeometry(shape) -> [Result, HP_DebugGeometryId]
        const [dbgRes, dbgId] = this.hk.HP_Shape_CreateDebugDisplayGeometry(shape);
        if (dbgRes !== this.hk.Result.RESULT_OK) return;

        // Info gives us raw WASM pointers which live inside hk.HEAP* views.
        const [infoRes, info] = this.hk.HP_DebugGeometry_GetInfo(dbgId);
        if (infoRes !== this.hk.Result.RESULT_OK) {
            this.hk.HP_DebugGeometry_Release(dbgId);
            return;
        }
        const [vPtr, vCount, tPtr, tCount] = info;

        if (vCount <= 0 || tCount <= 0)
        {
            this.hk.HP_DebugGeometry_Release(dbgId);
            return;
        }

        // Build Float32Array / Uint32Array views into the WASM heap
        const vBuf = new Float32Array(this.hk.HEAPF32.buffer, vPtr, vCount * 3);
        const tBuf = new Uint32Array(this.hk.HEAPU32.buffer, tPtr, tCount * 3);

        // Helper to transform local → world
        const tmp = [0, 0, 0];
        const toWorld = (local) => {
            // Cheap quaternion*vector – Havok quaternions are [x,y,z,w]
            const [lx, ly, lz] = local;
            const [qx, qy, qz, qw] = rot;
            const ix =  qw*lx + qy*lz - qz*ly;
            const iy =  qw*ly + qz*lx - qx*lz;
            const iz =  qw*lz + qx*ly - qy*lx;
            const iw = -qx*lx - qy*ly - qz*lz;
            tmp[0] = ix*qw + iw*-qx + iy*-qz - iz*-qy + pos[0];
            tmp[1] = iy*qw + iw*-qy + iz*-qx - ix*-qz + pos[1];
            tmp[2] = iz*qw + iw*-qz + ix*-qy - iy*-qx + pos[2];
            return [tmp[0], tmp[1], tmp[2]];
        };

        const getPoint = (a)=>
        {
            const vA = [vBuf[a*3], vBuf[a*3+1], vBuf[a*3+2]];
            return toWorld(vA);
        }

        for (let i = 0; i < tCount; ++i) {
            const a = tBuf[i*3 + 0];
            const b = tBuf[i*3 + 1];
            const c = tBuf[i*3 + 2];
            let p1 = getPoint(a);
            let p2 = getPoint(b);
            let p3 = getPoint(c);

            out.push({p1,p2,p3,colour});
        }

        this.hk.HP_DebugGeometry_Release(dbgId);
    }

    /***********************************
     * API for renderer                *
     ***********************************/

    getVertexBuffer(bodies) {
        // this.bodies = bodies;
        const { lines } = this.extract(bodies);
        // const data = [];
        // for (const l of lines) {
        //     data.push(...l.start, ...(l.colour ?? [1, 1, 1, 1]));
        //     data.push(...l.end,   ...(l.colour ?? [1, 1, 1, 1]));
        // }
        // return new Float32Array(data);
        return lines;
    }

    getLineCount() { return this.lastFrame.lines.length; }

    /** Allow runtime overrides. */
    setColour(cat, rgba) { this.colours[cat] = rgba; }
    getColour(cat) { return this.colours[cat]; }
}