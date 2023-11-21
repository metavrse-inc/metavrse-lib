/**
 * Object Scenegraph Component
 * @param {object} opt 
 */
 module.exports = (payload) => {
    const Physics = payload.Physics;

    let child = payload.child;
    let parent = payload.parent;

    const surface = Module.getSurface();
    const scene = surface.getScene();
    const { mat4, vec3, quat } = Module.require('assets/gl-matrix.js');

    let body = null;

    var render = () => { }; // header declaration

    let object = {
        item: {
            type: child.type,
            key: child.key,
            title: child.title,
        },
        idx: payload.idx,
        render_fov_visible: payload.render_fov_visible,
        render_fov_lod: payload.render_fov_lod,
        parent,
        center: vec3.create(),
        extents: vec3.create(),
        scales: vec3.create(),
        matrix : mat4.create(),
        body,
        children: new Map(),
    }

    const remove = ()=> {
        if (parent) parent.children.delete(child.key);
        Physics.removeUpdate(child.key);
        
    }
    
    var so = null;
    const addObject = (args) => {
        try {
            _addObject(args)
        } catch (error) {
        }
    }
    const _addObject = (args) => {
        let o = args.parent;
        let key = o.item.key;
        so = scene.getObject(key);
        if (!so) return;

        _object = so;
  
        if (object.item.type == "FOVMeshObject"){
            object.extents = so.getParameterVec3("extent");
            object.center = so.getParameterVec3("center");
        } else {
            object.extents = so.getParameterVec3(args.data.mesh, "extent");
            object.center = so.getParameterVec3(args.data.mesh,"center");
        }

        let extents = object.extents;
        let center = object.center;
        let q = quat.create();
        let size = [1,1,1];
        let scales = object.scales;
        let m = object.matrix;

        mat4.getScaling(scales, o.parentOpts.transform)
        size = [extents.f1, extents.f2, extents.f3]
        
        quat.fromEuler(q, ...o.rotate)

        if (o.parent && o.parent.parentOpts){
            let qParent = quat.create();
            mat4.getRotation(qParent, o.parent.parentOpts.transform);
            quat.multiply(q, qParent, q);
        }
        
        let positionOriginal = vec3.create();
        mat4.getTranslation(positionOriginal, o.parentOpts.transform)

        let position = vec3.fromValues(object.center.f1 * scales[0],
            object.center.f2 * scales[1], 
            object.center.f3 * scales[2])

        mat4.fromRotationTranslation(object.matrix, q, positionOriginal);
        
        mat4.translate(m, m, position);
        
        q = args.q || q;
        key = args.key || key;
  
        Module.ProjectManager.isDirty = true;
  
     }

    var isLoaded = false;

    let updateMath = {
        scales: vec3.create(),
        finalRotation: quat.create(),
        q2: quat.create(),
        m4: mat4.create(),
        m42: mat4.create(),
        _p: vec3.create(),
        q: quat.create(),
        _q: quat.create(),
        qParent: quat.create(),
        position: vec3.create(),
        positionMesh: vec3.create(),
        
        btScales: null,
        btTransform: null,
    }

    render = (opts) => {
        opts = opts || {};
        if (!isLoaded){
            isLoaded = true;

            addObject(payload)
        } else if (isLoaded) {
            if (opts.transform) {
                let scales = updateMath.scales;
                mat4.getScaling(scales, opts.transform)

                let q = updateMath.q;
                mat4.getRotation(q, opts.transform);

                let position = updateMath.position;
                mat4.getTranslation(position, opts.transform)

                let positionMesh = updateMath.positionMesh;
                vec3.set(positionMesh, object.center.f1 * scales[0],
                    object.center.f2 * scales[1], 
                    object.center.f3 * scales[2])

                let m4 = object.matrix;
                mat4.fromRotationTranslation(m4, q, position);
                mat4.translate(m4, m4, positionMesh);

            }
        }
    }

    const update = ()=> {
        
    }

    // add to physics world
    if (scene.getObject(payload.parent.item.key)){
        render();
    }
    // console.log(payload)

    // add to parent
    if (parent) parent.children.set(child.key, object);

    const getDebugLines = ()=> {
        if (!parent.parentOpts.visible){
            return {
                TheColors: [],
                TheLines: [],
                TheLinesCount: 0,
                TheColorsCount: 0
            }
        }
        let o = object.parent;
        let TheColors = [];
        let TheLines = [];
        let TheLinesCount = 0;
        let TheColorsCount = 0;
        let m4 = object.matrix;
        let extents = object.extents;
        let extent = [extents.f1, extents.f2, extents.f3];

        let q = [0,0,0,0];
        let p = [0,0,0];
        let s = [1,1,1];
        mat4.getRotation(q, m4);
        mat4.getTranslation(p, m4);
        mat4.getScaling(s, o.parentOpts.transform);

        vec3.multiply(s, s, extent);
        vec3.multiply(s, s, [0.5,0.5,0.5]);

        let tris = [];
        tris.push([[-1,-1,-1],[-1,1,-1]]);
        tris.push([[-1,-1,-1],[1,-1,-1]]);
        tris.push([[-1,-1,-1],[-1,-1,1]]);

        tris.push([[-1,1,1],[1,1,1]]);
        tris.push([[-1,1,1],[-1,1,-1]]);
        tris.push([[-1,1,1],[-1,-1,1]]);

        tris.push([[1,-1,1],[-1,-1,1]]);
        tris.push([[1,-1,1],[1,1,1]]);
        tris.push([[1,-1,1],[1,-1,-1]]);

        tris.push([[1,1,-1],[1,1,1]]);
        tris.push([[1,1,-1],[-1,1,-1]]);
        tris.push([[1,1,-1],[1,-1,-1]]);

        let r = 255;
        let g = 255;
        let b = 0;
        
        let addLine = (from, to)=> {
            TheLines.push(...from, ...to);
            TheLinesCount += 2;
    
            var colorFrom = [r, g, b];
            var colorTo = [r, g, b];
            TheColors.push(...colorFrom, ...colorTo);
            TheColorsCount += 2;
        }

        for (var line of tris){
            let from = [...line[0]];
            let to = [...line[1]];
            
            vec3.multiply(from, from, s);
            vec3.transformQuat(from, from, q);
            vec3.add(from, from, p);

            vec3.multiply(to, to, s);
            vec3.transformQuat(to, to, q);
            vec3.add(to, to, p);

            // vec3.transformMat4(from, from, m4)
            // vec3.transformMat4(to, to, m4)

            addLine(from, to);
        }

        return {
            TheColors,
            TheLines,
            TheLinesCount,
            TheColorsCount
        }

    }

    // Props and Methods
    Object.defineProperties(object, {
        object: { get: () => { return so; }, set: (v) => {} },
        // orientation: { get: () => { return (Module.ProjectManager.projectRunning) ? world.orientation : 0; }, set: (v) => { world.orientation = v; } },
    })
    
    Object.assign(object, {
        remove,
        render,
        update,
        getDebugLines
    })

    return object;
}