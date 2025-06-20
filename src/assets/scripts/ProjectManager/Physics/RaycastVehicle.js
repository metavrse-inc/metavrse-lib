/**
 * Object Scenegraph Component
 * @param {object} opt
 */
module.exports = (payload) => {
  const Physics = payload.Physics;
  // const Ammo = Physics.Ammo;
  // const PhysicsWorld = Physics.PhysicsWorld;
  const HavokSystem = Physics.Havok;


      // var wheelAxisPositionBack = -1 / vScale;
    // var wheelRadiusBack = 0.4 / vScale;
    // var wheelWidthBack = 0.3 / vScale;
    // var wheelHalfTrackBack = 1 / vScale - vOffset;
    // var wheelAxisHeightBack = 0.3 / vScale - vOffset;
  
    // var wheelAxisFrontPosition = 1.7 / vScale;
    // var wheelHalfTrackFront = 1 / vScale - vOffset;
    // var wheelAxisHeightFront = 0.3 / vScale - vOffset;
    // var wheelRadiusFront = 0.35 / vScale;
    // var wheelWidthFront = 0.2 / vScale;

  var VehicleConfig = {
        // Chassis properties
        chassisMass: 800, // kg
        chassisSize: [1.8, 0.6, 3], // width, height, length in meters
        // chassisSize: [2.0, 0.8, 4.5], // width, height, length in meters
        chassisCenterOfMass: [0, -0.0, 0],
        
        // Wheel properties
        wheelRadiusFront: 0.35, // meters
        wheelRadiusBack: 0.4, // meters
        wheelWidthFront: 0.2,  // meters
        wheelWidthBack: 0.3,  // meters
        wheelMassFront: 50,     // kg per wheel
        wheelMassBack: 50,     // kg per wheel
        wheelPositions: [
            // [-0.9, -0.0, 1.3],   // Front left
            // [0.9, -0.0, 1.3],    // Front right
            // [-0.9, -0.0, -1.3],  // Rear left
            // [0.9, -0.0, -1.3]    // Rear right

            [-0.75, -0.15, 1.0], 
            [0.75, -0.15, 1.0],
            [-0.75, -0.15, -1.0],
            [0.75, -0.15, -1.0],
        ],

        axleSize: [0.45,0.3,0.3],
        
        // Suspension properties
        suspensionStiffness: 30000,    // N/m
        suspensionDamping: 3000,       // Ns/m
        suspensionRestLength: 0.15,     // meters
        suspensionMaxTravel: 0.15,      // meters
        // this.hk.HP_Constraint_SetAxisMinLimit(constraintId, ConstraintAxis.LINEAR_Y, -this.config.suspensionMaxTravel);
        // this.hk.HP_Constraint_SetAxisMaxLimit(constraintId, ConstraintAxis.LINEAR_Y, this.config.suspensionRestLength);

        // Drive properties
        maxEngineForce: 800,          // N⋅m
        maxBrakeForce: 3000,           // N⋅m
        maxSteerAngle: Math.PI / 6,    // 45 degrees in radians
        
        // Physics materials
        chassisMaterial: [0.6, 0.6, 0.2, 0, 0], // static friction, dynamic friction, restitution, combine modes
        wheelMaterialFront: [150.2, 150.2, 0.1, 0, 0],   // Higher friction for wheels
        wheelMaterialRear: [150.2, 150.2, 0.1, 0, 0],   // Higher friction for wheels
        
        // Collision filtering
        chassisFilterInfo: [0xFFFF, 0xFFFF], // Collide with everything
        wheelFilterInfo: [0xFFFF, 0xFFFF]    // Collide with everything
    }

    const { MotionType, ConstraintAxis, ConstraintAxisLimitMode, ConstraintMotorType } = HavokSystem.havok;

    class HavokVehicleController {
        hk;//: HavokPhysicsWithBindings;
        worldId;
        config;
        
        // Vehicle components
        chassisBodyId;
        chassisShapeId;
        wheels = [];
        axles = [];
        
        // Current vehicle state
        currentInput = {
            throttle: 0,
            brake: 0,
            steering: 0,
            handbrake: false
        };        
    
        constructor(hk, worldId, config) {
            this.hk = hk;
            this.worldId = worldId;
            this.config = config;
            
            this.createVehicle();
        }
    
        createVehicle() {
            this.createChassis();
            this.creatAxles();
            this.creatAxlesConstraint();
            this.createWheels();
            this.setupSuspension();
            this.setupSteering();
            this.setupDriveSystem();
        }

        CalculateWheelAngles(averageAngle) {
            //
            // NOTE: This is needed because of https://en.wikipedia.org/wiki/Ackermann_steering_geometry
            //
            const wheelbase = 16;
            const trackWidth = 11;
        
            const avgRadius = wheelbase / Math.tan(averageAngle);
            const innerRadius = avgRadius - trackWidth / 2;
            const outerRadius = avgRadius + trackWidth / 2;
            const innerAngle = Math.atan(wheelbase / innerRadius);
            const outerAngle = Math.atan(wheelbase / outerRadius);
        
            return [innerAngle, outerAngle];
        }

        creatAxlesConstraint()
        {
          for (let i = 0; i < this.axles.length; i++) {
            const wheel = this.axles[i];
            
            // Create suspension constraint
            const [constraintResult, constraintId] = this.hk.HP_Constraint_Create();
            if (constraintResult !== this.hk.Result.RESULT_OK) {
                throw new Error(`Failed to create suspension constraint for wheel ${i}`);
            }
            
            wheel.suspensionConstraintId = constraintId;
            
            // Set constraint bodies
            this.hk.HP_Constraint_SetParentBody(constraintId, this.chassisBodyId);
            this.hk.HP_Constraint_SetChildBody(constraintId, wheel.bodyId);
            
            // Configure constraint anchors
            // Parent anchor (chassis)
            const parentPivot = wheel.position;
            const parentAxisX = [1, 0, 0]; // X-axis
            const parentAxisY = [0, 1, 0]; // Z-axis (suspension travel direction is Y)
            this.hk.HP_Constraint_SetAnchorInParent(constraintId, parentPivot, parentAxisX, parentAxisY);
            
            // Child anchor (wheel center)
            const childPivot = [0, 0, 0];
            const childAxisX = [1, 0, 0];
            const childAxisY = [0, 1, 0];
            this.hk.HP_Constraint_SetAnchorInChild(constraintId, childPivot, childAxisX, childAxisY);

            // Lock X and Z linear movement (wheel stays aligned with chassis)
            // this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.LINEAR_X, ConstraintAxisLimitMode.LIMITED);
            // this.hk.HP_Constraint_SetAxisMinLimit(constraintId, ConstraintAxis.LINEAR_X, 0);
            // this.hk.HP_Constraint_SetAxisMaxLimit(constraintId, ConstraintAxis.LINEAR_X, 0);
            
            // // Configure suspension axis (Y - vertical)
            this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.LINEAR_Y, ConstraintAxisLimitMode.LIMITED);
            this.hk.HP_Constraint_SetAxisMinLimit(constraintId, ConstraintAxis.LINEAR_Y, -0.6);
            this.hk.HP_Constraint_SetAxisMaxLimit(constraintId, ConstraintAxis.LINEAR_Y, 0.6);
            
            // // Set suspension spring properties
            this.hk.HP_Constraint_SetAxisStiffness(constraintId, ConstraintAxis.LINEAR_Y, 20000);
            this.hk.HP_Constraint_SetAxisDamping(constraintId, ConstraintAxis.LINEAR_Y, 23);
            

            // this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.LINEAR_Z, ConstraintAxisLimitMode.LIMITED);
            // this.hk.HP_Constraint_SetAxisMinLimit(constraintId, ConstraintAxis.LINEAR_Z, 0);
            // this.hk.HP_Constraint_SetAxisMaxLimit(constraintId, ConstraintAxis.LINEAR_Z, 0);
            
            // Allow wheel rotation around its axle (X-axis)
            // this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.ANGULAR_X, ConstraintAxisLimitMode.LIMITED);
            // this.hk.HP_Constraint_SetAxisMinLimit(constraintId, ConstraintAxis.ANGULAR_X, -0.25);
            // this.hk.HP_Constraint_SetAxisMaxLimit(constraintId, ConstraintAxis.ANGULAR_X, 0.25);

            
            // Lock other rotations initially (steering will modify this for front wheels)
            // this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.ANGULAR_Y, ConstraintAxisLimitMode.LOCKED);
            // this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.ANGULAR_Z, ConstraintAxisLimitMode.LOCKED);
            this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.ANGULAR_Z, ConstraintAxisLimitMode.LIMITED);
            this.hk.HP_Constraint_SetAxisMinLimit(constraintId, ConstraintAxis.ANGULAR_Z, -0.05);
            this.hk.HP_Constraint_SetAxisMaxLimit(constraintId, ConstraintAxis.ANGULAR_Z, 0.05);


            this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.LINEAR_X, ConstraintAxisLimitMode.LOCKED);
            // this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.LINEAR_Y, ConstraintAxisLimitMode.LOCKED);
            this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.LINEAR_Z, ConstraintAxisLimitMode.LOCKED);

            this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.LINEAR_DISTANCE, ConstraintAxisLimitMode.LOCKED);

            this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.ANGULAR_X, ConstraintAxisLimitMode.FREE);
            this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.ANGULAR_Y, ConstraintAxisLimitMode.LOCKED);
            // this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.ANGULAR_Z, ConstraintAxisLimitMode.LOCKED);
            
            // Enable constraint
            this.hk.HP_Constraint_SetEnabled(constraintId, 1);
          }
        }

        creatAxles()
        {
          for (let i = 0; i < 4; i++) 
          {
            const isSteerWheel = i < 2; // Front wheels can steer

            const wheelPos = this.config.wheelPositions[i];
            // Create chassis shape (box)
            // const [shapeResult, shapeId] = this.hk.HP_Shape_CreateBox(
            //   [0,0,0],
            //   [0, 0, 0, 1], // identity quaternion
            //   this.config.axleSize
            // );

            let width = (isSteerWheel) ? this.config.wheelWidthFront : this.config.wheelWidthBack;
            let radius = (isSteerWheel) ? this.config.wheelRadiusFront : this.config.wheelRadiusBack;
            let mass = (isSteerWheel) ? this.config.wheelMassFront : this.config.wheelMassBack;
            
            // Create wheel shape (cylinder)
            const [shapeResult, shapeId] = this.hk.HP_Shape_CreateCylinder(
                [-width / 2, 0, 0],
                [width / 2, 0, 0],
                radius
            );

            if (shapeResult !== this.hk.Result.RESULT_OK) {
              throw new Error('Failed to create axle shape');
            }

            // Create chassis body
            const [bodyResult, bodyId] = this.hk.HP_Body_Create();
            if (bodyResult !== this.hk.Result.RESULT_OK) {
                throw new Error('Failed to create chassis body');
            }

            this.hk.HP_Body_SetShape(bodyId, shapeId);
            this.hk.HP_Body_SetMotionType(bodyId, MotionType.DYNAMIC);

            this.hk.HP_Shape_SetFilterInfo(shapeId, this.config.wheelFilterInfo);
            this.hk.HP_Shape_SetDensity(shapeId, mass / (Math.PI * radius * radius * width));

            // Calculate and set mass properties
            const [massResult, massProps] = this.hk.HP_Shape_BuildMassProperties(shapeId);
            if (massResult === this.hk.Result.RESULT_OK) {
                // Scale mass properties to desired mass
                const scaledMassProps = [
                    massProps[0], // center of mass
                    mass, // mass
                    massProps[2], // inertia (keep relative proportions)
                    massProps[3]  // inertia orientation
                ];
                this.hk.HP_Body_SetMassProperties(bodyId, scaledMassProps);
            }

            // Position wheel relative to chassis
            // let r = quat.fromEuler([0,0,0,1], 0, 0, Math.PI / 2)
            const wheelTransform = [wheelPos, [0,0,0,1]];
            this.hk.HP_Body_SetQTransform(bodyId, wheelTransform);
            
            // Add wheel to world
            this.hk.HP_World_AddBody(this.worldId, bodyId, false);

            // Store wheel info
            const wheelInfo = {
                bodyId: bodyId,
                shapeId: shapeId,
                suspensionConstraintId: [BigInt(0)], // Will be set in setupSuspension
                driveConstraintId: [BigInt(0)], // Will be set in setupDriveSystem
                position: wheelPos,
                isDriveWheel: true,
                isSteerWheel
              };
            
            if (isSteerWheel) {
                wheelInfo.steerConstraintId = [BigInt(0)]; // Will be set in setupSteering
            }

            console.log(wheelInfo)
            
            this.axles.push(wheelInfo);
            

          }
        }
    
        createChassis() {
            // Create chassis shape (box)
            const [shapeResult, shapeId] = this.hk.HP_Shape_CreateBox(
                [0,0,0],
                [0, 0, 0, 1], // identity quaternion
                this.config.chassisSize
            );
            
            if (shapeResult !== this.hk.Result.RESULT_OK) {
                throw new Error('Failed to create chassis shape');
            }
            
            this.chassisShapeId = shapeId;
            
            // Set shape properties
            this.hk.HP_Shape_SetMaterial(this.chassisShapeId, this.config.chassisMaterial);
            this.hk.HP_Shape_SetFilterInfo(this.chassisShapeId, this.config.chassisFilterInfo);
            this.hk.HP_Shape_SetDensity(this.chassisShapeId, this.config.chassisMass / (this.config.chassisSize[0] * this.config.chassisSize[1] * this.config.chassisSize[2]));
            
            // Create chassis body
            const [bodyResult, bodyId] = this.hk.HP_Body_Create();
            if (bodyResult !== this.hk.Result.RESULT_OK) {
                throw new Error('Failed to create chassis body');
            }
            
            this.chassisBodyId = bodyId;
            
            // Configure chassis body
            this.hk.HP_Body_SetShape(this.chassisBodyId, this.chassisShapeId);
            this.hk.HP_Body_SetMotionType(this.chassisBodyId, MotionType.DYNAMIC);
            
            // Calculate and set mass properties
            const [massResult, massProps] = this.hk.HP_Shape_BuildMassProperties(this.chassisShapeId);
            if (massResult === this.hk.Result.RESULT_OK) {
                // Scale mass properties to desired mass
                const scaledMassProps = [
                    this.config.chassisCenterOfMass, // center of mass
                    this.config.chassisMass, // mass
                    massProps[2], // inertia (keep relative proportions)
                    massProps[3]  // inertia orientation
                ];
                this.hk.HP_Body_SetMassProperties(this.chassisBodyId, scaledMassProps);
            }
            
            // Set damping for stability
            this.hk.HP_Body_SetLinearDamping(this.chassisBodyId, 0.1);
            this.hk.HP_Body_SetAngularDamping(this.chassisBodyId, 0.1);
            
            // Add chassis to world
            this.hk.HP_World_AddBody(this.worldId, this.chassisBodyId, false);
        }
    
        createWheels() {
            for (let i = 0; i < 4; i++) {
                const wheelPos = this.config.wheelPositions[i];
                const isSteerWheel = i < 2; // Front wheels can steer
                const isDriveWheel = true;  // All wheels can be driven (AWD)

                let width = (isSteerWheel) ? this.config.wheelWidthFront : this.config.wheelWidthBack;
                let radius = (isSteerWheel) ? this.config.wheelRadiusFront : this.config.wheelRadiusBack;
                let mass = (isSteerWheel) ? this.config.wheelMassFront : this.config.wheelMassBack;
                
                // Create wheel shape (cylinder)
                const [shapeResult, shapeId] = this.hk.HP_Shape_CreateCylinder(
                    [-width / 2, 0, 0],
                    [width / 2, 0, 0],
                    radius
                );
                
                if (shapeResult !== this.hk.Result.RESULT_OK) {
                    throw new Error(`Failed to create wheel ${i} shape`);
                }
                
                // Set wheel shape properties
                if (isSteerWheel) this.hk.HP_Shape_SetMaterial(shapeId, this.config.wheelMaterialFront);
                else this.hk.HP_Shape_SetMaterial(shapeId, this.config.wheelMaterialRear);

                this.hk.HP_Shape_SetFilterInfo(shapeId, this.config.wheelFilterInfo);
                this.hk.HP_Shape_SetDensity(shapeId, mass / (Math.PI * radius * radius * width));
                
                // Create wheel body
                const [bodyResult, bodyId] = this.hk.HP_Body_Create();
                if (bodyResult !== this.hk.Result.RESULT_OK) {
                    throw new Error(`Failed to create wheel ${i} body`);
                }
                
                // Configure wheel body
                this.hk.HP_Body_SetShape(bodyId, shapeId);
                this.hk.HP_Body_SetMotionType(bodyId, MotionType.DYNAMIC);


                // Set mass properties
                const [massResult, massProps] = this.hk.HP_Shape_BuildMassProperties(shapeId);
                if (massResult === this.hk.Result.RESULT_OK) {
                    const scaledMassProps = [
                        massProps[0],
                        mass,
                        massProps[2],
                        massProps[3]
                    ];
                    this.hk.HP_Body_SetMassProperties(bodyId, scaledMassProps);
                }
                
                // Position wheel relative to chassis
                // let r = quat.fromEuler([0,0,0,1], 0, 0, Math.PI / 2)
                const wheelTransform = [wheelPos, [0,0,0,1]];
                this.hk.HP_Body_SetQTransform(bodyId, wheelTransform);
                
                // Add wheel to world
                this.hk.HP_World_AddBody(this.worldId, bodyId, false);
                
                // Store wheel info
                const wheelInfo = {
                    bodyId: bodyId,
                    shapeId: shapeId,
                    suspensionConstraintId: [BigInt(0)], // Will be set in setupSuspension
                    driveConstraintId: [BigInt(0)], // Will be set in setupDriveSystem
                    position: wheelPos,
                    isSteerWheel: isSteerWheel,
                    isDriveWheel: isDriveWheel
                };
                
                if (isSteerWheel) {
                    wheelInfo.steerConstraintId = [BigInt(0)]; // Will be set in setupSteering
                }

                console.log(wheelInfo)
                
                this.wheels.push(wheelInfo);
            }
        }
    
        setupSuspension() {
            for (let i = 0; i < this.wheels.length; i++) {
                const wheel = this.wheels[i];
                const axle = this.axles[i];
                
                // Create suspension constraint
                const [constraintResult, constraintId] = this.hk.HP_Constraint_Create();
                if (constraintResult !== this.hk.Result.RESULT_OK) {
                    throw new Error(`Failed to create suspension constraint for wheel ${i}`);
                }

                const [constraintResult2, constraintId2] = this.hk.HP_Constraint_Create();

                
                wheel.suspensionConstraintId = constraintId;
                
                // Set constraint bodies
                this.hk.HP_Constraint_SetParentBody(constraintId, axle.bodyId);
                this.hk.HP_Constraint_SetChildBody(constraintId, wheel.bodyId);

                this.hk.HP_Constraint_SetParentBody(constraintId2, this.chassisBodyId);
                this.hk.HP_Constraint_SetChildBody(constraintId2, wheel.bodyId);
                
                // Configure constraint anchors
                // Parent anchor (chassis)
                const parentPivot = [0,0,0];
                const parentAxisX = [1, 0, 0]; // X-axis
                const parentAxisY = [0, 1, 0]; // Z-axis (suspension travel direction is Y)
                this.hk.HP_Constraint_SetAnchorInParent(constraintId, parentPivot, parentAxisX, parentAxisY);
                
                // Child anchor (wheel center)
                const childPivot = [0, 0, 0];
                const childAxisX = [1, 0, 0];
                const childAxisY = [0, 1, 0];
                this.hk.HP_Constraint_SetAnchorInChild(constraintId, childPivot, childAxisX, childAxisY);
                
                // Configure suspension axis (Y - vertical)
                // this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.LINEAR_DISTANCE, ConstraintAxisLimitMode.LIMITED);
                // this.hk.HP_Constraint_SetAxisMinLimit(constraintId, ConstraintAxis.LINEAR_DISTANCE, 0);
                // this.hk.HP_Constraint_SetAxisMaxLimit(constraintId, ConstraintAxis.LINEAR_DISTANCE, 0);
                
                // // Set suspension spring properties
                // // this.hk.HP_Constraint_SetAxisStiffness(constraintId, ConstraintAxis.LINEAR_Y, this.config.suspensionStiffness);
                // // this.hk.HP_Constraint_SetAxisDamping(constraintId, ConstraintAxis.LINEAR_Y, this.config.suspensionDamping);
                
                // // Lock X and Z linear movement (wheel stays aligned with chassis)
                // // this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.LINEAR_X, ConstraintAxisLimitMode.LOCKED);
                // // this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.LINEAR_Z, ConstraintAxisLimitMode.LOCKED);
                
                // // Allow wheel rotation around its axle (X-axis)
                // // this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.ANGULAR_X, ConstraintAxisLimitMode.LOCKED);
                
                // // Lock other rotations initially (steering will modify this for front wheels)
                // this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.ANGULAR_Y, ConstraintAxisLimitMode.LIMITED);
                // this.hk.HP_Constraint_SetAxisMinLimit(constraintId, ConstraintAxis.ANGULAR_Y, 0);
                // this.hk.HP_Constraint_SetAxisMaxLimit(constraintId, ConstraintAxis.ANGULAR_Y, 0);

                // this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.ANGULAR_Z, ConstraintAxisLimitMode.LIMITED);
                // this.hk.HP_Constraint_SetAxisMinLimit(constraintId, ConstraintAxis.ANGULAR_Z, 0);
                // this.hk.HP_Constraint_SetAxisMaxLimit(constraintId, ConstraintAxis.ANGULAR_Z, 0);
                // this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.ANGULAR_Z, ConstraintAxisLimitMode.LIMITED);
                // this.hk.HP_Constraint_SetAxisMinLimit(constraintId, ConstraintAxis.ANGULAR_Z, -0.05);
                // this.hk.HP_Constraint_SetAxisMaxLimit(constraintId, ConstraintAxis.ANGULAR_Z, 0.05);


                this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.LINEAR_X, ConstraintAxisLimitMode.LOCKED);
                this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.LINEAR_Y, ConstraintAxisLimitMode.LOCKED);
                this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.LINEAR_Z, ConstraintAxisLimitMode.LOCKED);

                this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.LINEAR_DISTANCE, ConstraintAxisLimitMode.LOCKED);

                this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.ANGULAR_X, ConstraintAxisLimitMode.LOCKED);
                this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.ANGULAR_Y, ConstraintAxisLimitMode.LOCKED);
                this.hk.HP_Constraint_SetAxisMode(constraintId, ConstraintAxis.ANGULAR_Z, ConstraintAxisLimitMode.LOCKED);
                
                // Enable constraint
                this.hk.HP_Constraint_SetEnabled(constraintId, 1);
                this.hk.HP_Constraint_SetEnabled(constraintId2, 1);
            }
        }
    
        setupSteering() {
            for (let i = 0; i < this.axles.length; i++) {
                const wheel = this.axles[i];
                
                if (wheel.isSteerWheel && wheel.steerConstraintId) {
                    // For steering, we'll modify the suspension constraint to allow Y-axis rotation
                    this.hk.HP_Constraint_SetAxisMode(wheel.suspensionConstraintId, ConstraintAxis.ANGULAR_Y, ConstraintAxisLimitMode.LIMITED);
                    this.hk.HP_Constraint_SetAxisMinLimit(wheel.suspensionConstraintId, ConstraintAxis.ANGULAR_Y, -this.config.maxSteerAngle);
                    this.hk.HP_Constraint_SetAxisMaxLimit(wheel.suspensionConstraintId, ConstraintAxis.ANGULAR_Y, this.config.maxSteerAngle);
                    
                    // Set up steering motor
                    this.hk.HP_Constraint_SetAxisMotorType(wheel.suspensionConstraintId, ConstraintAxis.ANGULAR_Y, ConstraintMotorType.POSITION);
                    this.hk.HP_Constraint_SetAxisMotorPositionTarget(wheel.suspensionConstraintId, ConstraintAxis.ANGULAR_Y, 0);
                    this.hk.HP_Constraint_SetAxisMotorMaxForce(wheel.suspensionConstraintId, ConstraintAxis.ANGULAR_Y, 15000);
                }
            }
        }
    
        setupDriveSystem() {
            for (let i = 0; i < this.axles.length; i++) {
                const wheel = this.axles[i];
                
                if (wheel.isDriveWheel) {
                    // Set up drive motor on the wheel rotation axis (X-axis)
                    this.hk.HP_Constraint_SetAxisMotorType(wheel.suspensionConstraintId, ConstraintAxis.ANGULAR_X, ConstraintMotorType.VELOCITY);
                    this.hk.HP_Constraint_SetAxisMotorVelocityTarget(wheel.suspensionConstraintId, ConstraintAxis.ANGULAR_X, 0);
                    this.hk.HP_Constraint_SetAxisMotorMaxForce(wheel.suspensionConstraintId, ConstraintAxis.ANGULAR_X, this.config.maxEngineForce);
                }
            }
        }
    
        setInput(input) {
            this.currentInput = { ...input };
            this.updateVehicle();
        }
    
        updateVehicle() {
          this.updateDriveForces();
          this.updateSteering();
          return;
            this.updateBraking();
        }
    
        updateSteering() {
            const steerAngle = this.currentInput.steering * this.config.maxSteerAngle;

            let [innerAngle, outerAngle] = this.CalculateWheelAngles(steerAngle)
            
            // for (const wheel of this.axles) {
            //     if (wheel.isSteerWheel) {
            //         this.hk.HP_Constraint_SetAxisMotorPositionTarget(
            //             wheel.suspensionConstraintId, 
            //             ConstraintAxis.ANGULAR_Y, 
            //             steerAngle
            //         );
            //     }
            // }

            let steerWheelA = this.axles[0];
            let steerWheelB = this.axles[1];

            this.hk.HP_Constraint_SetAxisMotorPositionTarget(steerWheelA.suspensionConstraintId, ConstraintAxis.ANGULAR_Y, outerAngle);
            this.hk.HP_Constraint_SetAxisMotorPositionTarget(steerWheelB.suspensionConstraintId, ConstraintAxis.ANGULAR_Y, innerAngle);

            return;

            const velocities = this.getChassisVelocity();
            // { linear: linVel, angular: angVel }

            const speed = vec3.length(velocities.linear);

            if (speed < 1.0) return;

            const GAIN           = 1;                         // 0.1-1.0  (arcade feel)
            const MAX_TORQUE     = 500;  

            const yawRateDesired = speed * Math.tan(steerAngle) / this.config.wheelRadius;

            // console.log(-yawRateDesired)

            // Current yaw rate and inertia ------------------------------------
            const yawRateNow     = velocities.angular[1];       // rad·s-1

            const [resMP, massProps] =
              HavokSystem.havok.HP_Shape_BuildMassProperties(this.chassisShapeId);

            const Iy             = massProps[1] * massProps[2][1];        // kg·m² (yaw axis)

            // Proportional control torque -------------------------------------
            let torque = (yawRateDesired - yawRateNow) * Iy * GAIN;

            // Optional quadratic gain with speed for snappier high-speed assist
            // torque *= Math.min(1, speed / 15); // gentle fade-in until 15 m/s

            torque = Math.max(-MAX_TORQUE, Math.min(MAX_TORQUE, torque)) * Physics.rawDelta;

            this.hk.HP_Body_ApplyAngularImpulse(this.chassisBodyId, [0, torque, 0]);

            // console.log(torque)
            
        }
    
        updateDriveForces() {
            // FIXED: More realistic drive force calculation
          const maxSpeed = 42; // m/s (about 67 mph)
          
          // Calculate dynamic force based on current speed vs target speed
          const chassisVelocity = this.getChassisVelocity();
          let currentSpeed = 0;
          if (chassisVelocity) {
            currentSpeed = Math.sqrt(
              chassisVelocity.linear[0] * chassisVelocity.linear[0] + 
              chassisVelocity.linear[2] * chassisVelocity.linear[2]
            );
          }
          
          // Reduce force at higher speeds to prevent excessive acceleration
          const speedRatio = Math.min(currentSpeed / maxSpeed, 1.0);
          const dynamicForce = this.config.maxEngineForce * (1.0 - speedRatio * 0.7);
          
          for (const wheel of this.axles) {
              let radius = (wheel.isSteerWheel && wheel.steerConstraintId) ? this.config.wheelRadiusFront : this.config.wheelRadiusBack;
              const targetAngularVelocity = (this.currentInput.throttle * maxSpeed) / radius;
              if (wheel.isDriveWheel) {
                  this.hk.HP_Constraint_SetAxisMotorVelocityTarget(
                      wheel.suspensionConstraintId,
                      ConstraintAxis.ANGULAR_X,
                      targetAngularVelocity
                  );
                  
                  this.hk.HP_Constraint_SetAxisMotorMaxForce(
                      wheel.suspensionConstraintId,
                      ConstraintAxis.ANGULAR_X,
                      Math.abs(dynamicForce)
                  );
              }
          }
            // const throttleForce = this.currentInput.throttle * this.config.maxEngineForce;
            
            // // Calculate target wheel angular velocity based on throttle
            // // Assuming wheel circumference and desired speed relationship
            
            // for (const wheel of this.wheels) {
            //     let radius = (wheel.isSteerWheel && wheel.steerConstraintId) ? this.config.wheelRadiusFront : this.config.wheelRadiusBack;
            //     const targetAngularVelocity = (this.currentInput.throttle * 50) / radius; // 50 m/s max speed

            //     if (wheel.isDriveWheel) {
            //         this.hk.HP_Constraint_SetAxisMotorVelocityTarget(
            //             wheel.suspensionConstraintId,
            //             ConstraintAxis.ANGULAR_X,
            //             targetAngularVelocity
            //         );
                    
            //         this.hk.HP_Constraint_SetAxisMotorMaxForce(
            //             wheel.suspensionConstraintId,
            //             ConstraintAxis.ANGULAR_X,
            //             Math.abs(throttleForce)
            //         );
            //     }
            // }

        }
    
        updateBraking() {
            const brakeForce = this.currentInput.brake * this.config.maxBrakeForce;
            const handbrakeForce = this.currentInput.handbrake ? this.config.maxBrakeForce : 0;
            
            for (let i = 0; i < this.wheels.length; i++) {
                const wheel = this.wheels[i];
                let totalBrakeForce = brakeForce;
                
                // Handbrake typically affects rear wheels more
                if (i >= 2) { // Rear wheels
                    totalBrakeForce += handbrakeForce;
                }
                
                if (totalBrakeForce > 0) {
                    // Apply brake friction
                    this.hk.HP_Constraint_SetAxisFriction(
                        wheel.suspensionConstraintId,
                        ConstraintAxis.ANGULAR_X,
                        totalBrakeForce
                    );
                } else {
                    // Reset friction when not braking
                    this.hk.HP_Constraint_SetAxisFriction(
                        wheel.suspensionConstraintId,
                        ConstraintAxis.ANGULAR_X,
                        0
                    );
                }
            }
        }
    
        getChassisTransform() {
            const [result, transform] = this.hk.HP_Body_GetQTransform(this.chassisBodyId);
            return result === this.hk.Result.RESULT_OK ? transform : null;
        }
    
        getChassisVelocity() {
            const [linResult, linVel] = this.hk.HP_Body_GetLinearVelocity(this.chassisBodyId);
            const [angResult, angVel] = this.hk.HP_Body_GetAngularVelocity(this.chassisBodyId);
            
            if (linResult === this.hk.Result.RESULT_OK && angResult === this.hk.Result.RESULT_OK) {
                return { linear: linVel, angular: angVel };
            }
            return null;
        }
    
        getWheelTransforms() {
            return this.wheels.map(wheel => {
                const [result, transform] = this.hk.HP_Body_GetQTransform(wheel.bodyId);
                return result === this.hk.Result.RESULT_OK ? transform : null;
            });
        }
    
        reset(position, orientation) {
            // Reset chassis
            const chassisTransform = [position, orientation];
            this.hk.HP_Body_SetQTransform(this.chassisBodyId, chassisTransform);
            this.hk.HP_Body_SetLinearVelocity(this.chassisBodyId, [0, 0, 0]);
            this.hk.HP_Body_SetAngularVelocity(this.chassisBodyId, [0, 0, 0]);
            
            // Reset wheels
            for (let i = 0; i < this.wheels.length; i++) {
                const wheel = this.wheels[i];
                const wheelPos = [
                    position[0] + this.config.wheelPositions[i][0],
                    position[1] + this.config.wheelPositions[i][1],
                    position[2] + this.config.wheelPositions[i][2]
                ];
                const wheelTransform = [wheelPos, orientation];
                
                this.hk.HP_Body_SetQTransform(wheel.bodyId, wheelTransform);
                this.hk.HP_Body_SetLinearVelocity(wheel.bodyId, [0, 0, 0]);
                this.hk.HP_Body_SetAngularVelocity(wheel.bodyId, [0, 0, 0]);
            }

            for (let i = 0; i < this.axles.length; i++) {
                const wheel = this.axles[i];
                const wheelPos = [
                    position[0] + this.config.wheelPositions[i][0],
                    position[1] + this.config.wheelPositions[i][1],
                    position[2] + this.config.wheelPositions[i][2]
                ];
                const wheelTransform = [wheelPos, orientation];
                
                this.hk.HP_Body_SetQTransform(wheel.bodyId, wheelTransform);
                this.hk.HP_Body_SetLinearVelocity(wheel.bodyId, [0, 0, 0]);
                this.hk.HP_Body_SetAngularVelocity(wheel.bodyId, [0, 0, 0]);
            }
            
            // Reset input
            this.currentInput = { throttle: 0, brake: 0, steering: 0, handbrake: false };
        }
    
        destroy() {
            // Release constraints
            for (const wheel of this.wheels) {
                this.hk.HP_Constraint_Release(wheel.suspensionConstraintId);
                if (wheel.steerConstraintId) {
                    this.hk.HP_Constraint_Release(wheel.steerConstraintId);
                }
            }
            
            // Remove bodies from world and release them
            this.hk.HP_World_RemoveBody(this.worldId, this.chassisBodyId);
            this.hk.HP_Body_Release(this.chassisBodyId);
            
            for (const wheel of this.wheels) {
                this.hk.HP_World_RemoveBody(this.worldId, wheel.bodyId);
                this.hk.HP_Body_Release(wheel.bodyId);
            }
            
            // Release shapes
            this.hk.HP_Shape_Release(this.chassisShapeId);
            for (const wheel of this.wheels) {
                this.hk.HP_Shape_Release(wheel.shapeId);
            }
        }
    }

  ///

  let child = payload.child;
  let parent = payload.parent;
  const redrawAddMethod = payload.addToRedraw;
  let sceneprops = payload.sceneprops;
  let scaleT = 0.1;
  const addToUpdated = payload.addToUpdated;

  var _d = payload.data;

  const surface = Module.getSurface();
  const scene = surface.getScene();
  const { mat4, vec3, quat } = Module.require('assets/gl-matrix.js');
  const { quaternionToEuler } = Module.require(
    'assets/ProjectManager/Physics/helpers.js'
  );

  let renderList = [];
  let body = null;
//   let vehicle = null;
  let onUpdate = null;

  //havok
  let havokBody = null;
  let havokShape = null;
  const wheels = [];
  const joints = [];
  const wheelConstraints = [];
  var vehicle = null;

  // gravit y
  // let rayTo = new Ammo.btVector3(0, -1, 0);
  // let btGravity = new Ammo.btVector3(0, -9.8, 0);
  // let characterGravity = new Ammo.btVector3(0, -9.8, 0);
  // let currentGravity = 0;

  let updateHandlers = new Map();
  let preupdateHandlers = new Map();

  let requestAnimationFrame = Module.animations['requestAnimationFrame'];

  const getFile = (file, buffer) => {
    try {
      const archive =
        Module.ProjectManager && Module.ProjectManager.archive
          ? Module.ProjectManager.archive
          : undefined;
      var _f;
      if (file.includes('assets/')) {
        _f = surface.readBinary(file);
      } else if (!scene.hasFSZip()) {
        _f = surface.readBinary(Module.ProjectManager.path + file);
      } else {
        _f = archive.fopen(file);
      }

      if (buffer) return _f;
      return new TextDecoder('utf-8').decode(_f);
    } catch (e) {
      return;
    }
  };

  var render = () => {}; // header declaration

  let params = {
    mass: _d['mass'] !== undefined ? Number(_d['mass']) : 0,
    ghost: _d['ghost'] !== undefined ? _d['ghost'] : false,

    // shapes
    shape_type:
      _d['shape_type'] !== undefined ? _d['shape_type'] : 'bounding-box',
    shape_file: _d['shape_file'] !== undefined ? _d['shape_file'] : '',

    position: _d['position'] !== undefined ? [..._d['position']] : [0, 0, 0],
    rotate: _d['rotate'] !== undefined ? [..._d['rotate']] : [0, 0, 0],
    scale: _d['scale'] !== undefined ? [..._d['scale']] : [1, 1, 1],
    groupMat:
      _d['groupMat'] !== undefined ? [..._d['groupMat']] : mat4.create(),

    object_position:
      _d['object_position'] !== undefined
        ? [..._d['object_position']]
        : [0, 0, 0],
    object_rotate:
      _d['object_rotate'] !== undefined
        ? [..._d['object_rotate']]
        : [0, 0, 0, 1],
    object_scale:
      _d['object_scale'] !== undefined ? [..._d['object_scale']] : [1, 1, 1],
    controller: _d['controller'] !== undefined ? _d['controller'] : [],
  };

  // Vehicle contants
  var vScale = 1;
  var vOffset = 0.25;
  var chassisWidth = 1.8 / vScale;
  var chassisHeight = 0.6 / vScale;
  var chassisLength = 3 / vScale;
  var massVehicle = 1200 / vScale;

  var wheelAxisPositionBack = -1 / vScale;
  var wheelRadiusBack = 0.4 / vScale;
  var wheelWidthBack = 0.3 / vScale;
  var wheelHalfTrackBack = 1 / vScale - vOffset;
  var wheelAxisHeightBack = 0.3 / vScale - vOffset;

  var wheelAxisFrontPosition = 1.7 / vScale;
  var wheelHalfTrackFront = 1 / vScale - vOffset;
  var wheelAxisHeightFront = 0.3 / vScale - vOffset;
  var wheelRadiusFront = 0.35 / vScale;
  var wheelWidthFront = 0.2 / vScale;

//   anchors = [
  // addWheel(true, new Ammo.btVector3(wheelHalfTrackFront, wheelAxisHeightFront, wheelAxisFrontPosition), wheelRadiusFront, wheelWidthFront, FRONT_LEFT);
  // addWheel(true, new Ammo.btVector3(-wheelHalfTrackFront, wheelAxisHeightFront, wheelAxisFrontPosition), wheelRadiusFront, wheelWidthFront, FRONT_RIGHT);
  // addWheel(false, new Ammo.btVector3(-wheelHalfTrackBack, wheelAxisHeightBack, wheelAxisPositionBack), wheelRadiusBack, wheelWidthBack, BACK_LEFT);
  // addWheel(false, new Ammo.btVector3(wheelHalfTrackBack, wheelAxisHeightBack, wheelAxisPositionBack), wheelRadiusBack, wheelWidthBack, BACK_RIGHT);
//   ];
  var friction = 1;
  var suspensionStiffness = 20.0 / vScale;
  var suspensionDamping = 2.3 / vScale;
  var suspensionCompression = 4.4 / vScale;
  var suspensionRestLength = 0.6 / vScale;
  var rollInfluence = 0 / vScale;

  var steeringIncrement = 0.04;
  var steeringClamp = 0.5;
  var maxEngineForce = 2000;
  var maxBreakingForce = 100;

  var steeringAngleMax = Math.PI / 6;

  let props = {};

  if (_d.props) {
    Object.keys(_d['props']).map((prop) => {
      prop = String(prop);
      props[prop] = _d['props'][prop];
    });
  }

  let object = {
    item: {
      type: child.type,
      key: child.key,
      title: child.title,
    },
    idx: payload.idx,
    parent,
    children: new Map(),
  };

  const deleteBody = () => {
    
  };

  const remove = () => {
    updateHandlers.clear();
    if (parent) parent.children.delete(child.key);
    Physics.removeUpdate(child.key);
    onUpdate = null;

  };

  let _object = null;
  var geometry;
  let extents = { f1: 0, f2: 0, f3: 0 };
  let center = { f1: 0, f2: 0, f3: 0 };
  const addObject = (args) => {
    try {
      _addObject(args);
    } catch (error) {
        console.error(error)
    }
  };
  const _addObject = (args) => {
    let o = args.parent;
    let key = o.item.key;
    let so = scene.getObject(key);

    if (!so) {
      // treat as group
      so = {
        getParameterVec3: (type) => {
          if (type == 'extent') return { f1: 2, f2: 2, f3: 2 };
          else if (type == 'center') return { f1: 1, f2: 1, f3: 1 };
        },
        setTransformMatrix: (transform) => {
          for (let [key, child] of o.children) {
            if (
              !(
                child.type == 'RigidBody' ||
                child.type == 'KinematicCharacterController' ||
                child.type == 'RaycastVehicle'
              )
            )
              child.render({ transform });
          }
        },
      };
    }

    _object = so;
    vehicle = new HavokVehicleController(HavokSystem.havok, HavokSystem.world, VehicleConfig);

    console.log(vehicle)

    havokBody = vehicle.chassisBodyId;

  };

  const onEvent = (event) => {
    if (eventHandler.size == 0) return;

    let bodyAkey = HavokSystem.ids.get(event.bodyA);
    let bodyBkey = HavokSystem.ids.get(event.bodyB);

    let type = -1;

    switch (event.type) {
      case 8:
        type = 'TRIGGER_ENTERED';
        break;
      case 16:
        type = 'TRIGGER_EXITED';
      default:
        break;
    }

    for (var [, handler] of eventHandler) {
      handler({ type, keyA: bodyAkey, keyB: bodyBkey, rawEvent: event });
    }
  };


  function updateVehicleControls(steering, throttle, brake, handbrake = false) {
    vehicle.setInput({
        throttle,    // Half throttle forward
        brake,         // No braking
        steering,    // Turn right
        handbrake  // Handbrake off
    });
  }

  var isLoaded = false;
  let TRANSFORM_AUX = null;

  let reAddTimer = null;
  let reAdd = () => {
    deleteBody();
    isLoaded = false;
    render();
  };

  var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;
  var ARGUMENT_NAMES = /([^\s,]+)/g;
  var getParamNames = (func) => {
    try {
      var fnStr = func.toString().replace(STRIP_COMMENTS, '');
      var result = fnStr
        .slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')'))
        .match(ARGUMENT_NAMES);
      if (result === null) result = [];
      return result;
    } catch (error) {}

    return [];
  };

  var applyParam = (opts) => {
    // try {
    //   if (Reflect.has(body, opts.prop)) {
    //     let fnArgs = getParamNames(Reflect.get(body, opts.prop));
    //     let fnValues = JSON.parse('[' + opts.value + ']');

    //     if (fnArgs.length != fnValues.length)
    //       throw `[${opts.prop}] Wrong number of arguments, expected ${fnArgs.length} but received ${fnValues.length}`;

    //     let finalValues = [];

    //     for (var v of fnValues) {
    //       if (Array.isArray(v) && v.length == 3)
    //         finalValues.push(new Ammo.btVector3(...v));
    //       else finalValues.push(v);
    //     }

    //     body[opts.prop](...finalValues);
    //   }
    // } catch (error) {
    //   // console.log(error)
    // }
  };

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
    btScales: null,
    btTransform: null,
  };

  render = (opts) => {
    opts = opts || {};
    let renderTransform = false;

    if (!isLoaded) {
      isLoaded = true;
      // TRANSFORM_AUX = new Ammo.btTransform();
      // updateMath.btScales = new Ammo.btVector3();
      // updateMath.btTransform = new Ammo.btTransform();

      // if (Physics.isResetting){
      addObject(payload);
      // }else{
      //     setTimeout(()=>{
      //         addObject(payload)
      //     });
      // }
    } else if (isLoaded && body) {
      let reInsert = false;
      // console.log(opts, renderList)
      for (var o of renderList) {
        if (o.type == 'transform') renderTransform = true;
        else if (o.type == 'readd') reInsert = true;
        else if (o.type == 'props') {
          if (o.value.type == 'set') {
            applyParam(o.value);
          }
        }
      }

      if (reInsert) {
        renderList = [];
        reAdd();
        return;
      }

      renderList = [];
      if (
        (opts.transform || renderTransform) &&
        (!Module.ProjectManager.projectRunning ||
          (Module.ProjectManager.projectRunning && massVehicle == 0))
      ) {
        let o = payload.parent;
        let scales = updateMath.scales;
        mat4.getScaling(scales, o.parentOpts.transform);

        let q = updateMath.q;
        // let q3 = quat.create();
        quat.fromEuler(q, ...o.rotate);
        // mat4.getRotation(q, o.parentOpts.transform)
        // quat.sub(q, q, q3);

        if (o.parent && o.parent.parentOpts) {
          let qParent = updateMath.qParent;
          mat4.getRotation(qParent, o.parent.parentOpts.transform);
          quat.multiply(q, qParent, q);
        }

        let position = updateMath.position;
        mat4.getTranslation(position, o.parentOpts.transform);

        // 3d transformation
        let m4 = updateMath.m4;
        mat4.fromRotationTranslation(m4, q, position);

        // rigidbody transformation
        let q2 = updateMath.q2;
        quat.fromEuler(q2, ...params.rotate);
        let m42 = updateMath.m42;
        mat4.fromRotationTranslation(m42, q2, params.position);

        mat4.multiply(m4, m4, m42);

        var transform = updateMath.btTransform;

        let ms = body.getMotionState();

        vec3.multiply(scales, scales, params.scale);
        let sc = updateMath.btScales;
        sc.setValue(...scales);
        geometry.setLocalScaling(sc);

        ms.getWorldTransform(transform);
        transform.setFromOpenGLMatrix(m4);
        ms.setWorldTransform(transform);

        body.setMotionState(ms);
        Module.ProjectManager.isDirty = true;
      }
    }
  };

  let physics_transformation = {
    position: vec3.create(),
    rotation: quat.create(),
    linear: vec3.create(),
    angular: vec3.create(),
    m4: mat4.create(),
  };

  let previousState = null;
  let currentState = null;

  const update = (forced) => {
    if (!isLoaded || !havokBody) return;
    if (massVehicle <= 0) return;

    let o = payload.parent;
    let m4 = physics_transformation.m4;

    // interpolate
    if (currentState == null || previousState == null) return;

    const prev = previousState;
    const latest = currentState;

    // LATEST
    interpPos = [...latest.position];
    interpRot = [...latest.rotation];
    // let interpPos = vec3.lerp([0,0,0], prev.position, latest.position, latest.alpha);
    // let interpRot = quat.slerp([0,0,0], prev.rotation, latest.rotation, latest.alpha);

    // let mp = false;
    // let mr = false;
    // if (vec3.equals(physics_transformation.position, interpPos)) mp = true;   // approx using epsilon
    // if (quat.equals(physics_transformation.rotation, interpRot)) mr = true;   // approx using epsilon

    // if (mp && mr) return;

    physics_transformation.position = interpPos;
    physics_transformation.rotation = interpRot;

    // vec3.lerp(physics_transformation.position, physics_transformation.position, interpPos, 0.9);
    // quat.slerp(physics_transformation.rotation, physics_transformation.rotation, interpRot, 0.9);

    let scales = updateMath.scales;
    mat4.getScaling(scales, o.parentOpts.transform);

    let finalRotation = updateMath.finalRotation;
    quat.set(finalRotation, ...params.object_rotate);
    quat.multiply(
      finalRotation,
      physics_transformation.rotation,
      finalRotation
    );
    // physics
    mat4.fromRotationTranslationScale(
      m4,
      finalRotation,
      physics_transformation.position,
      scales
    );

    // physics transformation
    let q2 = updateMath.q2;
    quat.fromEuler(q2, ...params.rotate);
    let m42 = updateMath.m42;
    mat4.fromRotationTranslation(m42, q2, params.position);
    mat4.invert(m42, m42);

    mat4.multiply(m4, m42, m4);

    // adjust matrix directly
    _object.setTransformMatrix(m4);

    Module.ProjectManager.isDirty = true;

    try {
      let FOVMeshes = o.FOVMeshes;
      for (var m of FOVMeshes) {
        m.render({ transform: m4 });
      }
    } catch (error) {}
  };

  const updateState = () => {
    if (!isLoaded || !havokBody) return;
    if (massVehicle <= 0) return;

    vehicle.updateVehicle();

    const [, p] = HavokSystem.havok.HP_Body_GetPosition(havokBody);
    const [, q] = HavokSystem.havok.HP_Body_GetOrientation(havokBody);
    const [, lv] = HavokSystem.havok.HP_Body_GetLinearVelocity(havokBody);
    const [, av] = HavokSystem.havok.HP_Body_GetAngularVelocity(havokBody);

    var state = {
      position: p,
      rotation: q,
      linear: lv,
      angular: av,
      alpha: 1,
    };

    vec3.set(physics_transformation.linear, ...state.linear);
    vec3.set(physics_transformation.angular, ...state.angular);

    physics_transformation.alpha = 0;

    previousState = currentState;
    currentState = {
      alpha: state.alpha,
      position: state.position,
      rotation: state.rotation,
      angular: state.angular,
    };

    update();

    for (var [k, funcUp] of updateHandlers) {
      try {
        funcUp(state.alpha);
      } catch (error) {}
    }
  };
  // add to physics world
  if (
    payload.parent.item.type == 'object-group' ||
    scene.getObject(payload.parent.item.key)
  ) {
    render();
  }
  // console.log(payload)

  let addUpdateHandler = (func) => {
    updateHandlers.set(func, func);
  };

  let removeUpdateHandler = (func) => {
    updateHandlers.delete(func);
  };

  // add to parent
  if (parent) parent.children.set(child.key, object);

  const addToRedraw = (type, value) => {
    renderList.push({ type, value });
    redrawAddMethod(child.key, object);
  };

  let getProperty = (param) => {
    return params[param];
  };

  let setProperty = (param, val, redraw) => {
    params[param] = val;
    addToRedraw(redraw);
    addToUpdated(child.key, 'changed', { prop: param, value: val });
  };

  let propdata = {
    rename: (prop, newprop) => {
      if (props[prop] != undefined && prop !== newprop) {
        props[newprop] = props[prop];
        delete props[prop];

        addToRedraw('props', { type: 'rename', prop, newprop });
        addToUpdated(child.key, 'changed', { prop: 'props', value: props });
      }
    },

    remove: (prop) => {
      if (props[prop] != undefined) {
        delete props[prop];
        addToRedraw('props', { type: 'remove', prop });
        addToUpdated(child.key, 'changed', { prop: 'props', value: props });
      }
    },

    get: (prop) => {
      return props[prop];
    },

    set: (prop, value) => {
      props[prop] = value;
      addToRedraw('props', { type: 'set', prop, value });
      addToUpdated(child.key, 'changed', { prop: 'props', value: props });
    },
  };

  const eventHandler = new Map();

  const RB = {
    addEventHandler: (handler) => {
      eventHandler.set(handler, handler);
    },

    removeEventHandler: (handler) => {
      eventHandler.delete(handler);
    },
    set: (options) => {
      // AmmoWorker.postMessage({
      //     type: 'SET',
      //     key: object.idx,
      //     options
      // })
      try {
        for (var opts of options) {
          // if (opts.prop != "setLinearVelocity")
          //     console.log(opts.prop, opts.value)

          if (opts.prop == 'setLinearVelocity') {
            HavokSystem.havok.HP_Body_SetLinearVelocity(havokBody, opts.value);
          } else if (opts.prop == 'setAngularVelocity') {
            HavokSystem.havok.HP_Body_SetAngularVelocity(havokBody, opts.value);
          } else if (opts.prop == 'setGravity') {
            HavokSystem.havok.HP_Body_SetGravityFactor(havokBody, opts.value);
          } else if (opts.prop == 'setMassProperties') {
            // 1) Get the body’s shape ID (we assume a single shape per body)
            const shapeId = HavokSystem.havok.HP_Body_GetShape(havokBody)[1];

            // 2) Build the default (density=1) mass properties from that shape:
            //    [ centerOfMass: Vector3, massValue: number, inertia: Vector3, inertiaOrient: Quaternion ]
            const [resMP, massProps] =
              HavokSystem.havok.HP_Shape_BuildMassProperties(shapeId);
            if (resMP !== HavokSystem.havok.Result.RESULT_OK) {
              console.error('Failed to build mass properties:', resMP);
              continue;
            }

            // 3) Extract the original mass and inertia vector:
            const originalMass = massProps[1];
            const originalInertia = massProps[2]; // [ ix, iy, iz ]

            const newMass = opts.value[0];
            const inertia = opts.value[1];

            // 4) Compute scale factor to adjust inertia for new mass:
            let inertiaScale = 1;
            if (originalMass > 0) {
              inertiaScale = newMass / originalMass;
            }

            // 5) Overwrite massValue and scale the inertia vector:
            massProps[1] = newMass;
            massProps[2][0] = originalInertia[0] * inertiaScale * inertia;
            massProps[2][1] = originalInertia[1] * inertiaScale * inertia;
            massProps[2][2] = originalInertia[2] * inertiaScale * inertia;
            // massProps[3] (inertia orientation) remains unchanged

            // 6) Reapply to the body:
            const resSet = HavokSystem.havok.HP_Body_SetMassProperties(
              havokBody,
              massProps
            );
            if (resSet !== HavokSystem.havok.Result.RESULT_OK) {
              console.error('Failed to set mass properties:', resSet);
            }
          } else if (opts.prop == 'setDamping') {
            HavokSystem.havok.HP_Body_SetLinearDamping(
              havokBody,
              opts.value[0]
            );
            HavokSystem.havok.HP_Body_SetAngularDamping(
              havokBody,
              opts.value[1]
            );
          } else if (opts.prop == 'warp') {
            // 1) Build a QTransform: [ translation: Vector3, rotation: Quaternion ]
            const qTransform = [opts.value[0], opts.value[1]];

            // 2) Set the new transform immediately:
            HavokSystem.havok.HP_Body_SetQTransform(havokBody, qTransform);

            // 3) Zero out any existing linear/angular velocity so it doesn't “fly off”:
            HavokSystem.havok.HP_Body_SetLinearVelocity(havokBody, [0, 0, 0]);
            HavokSystem.havok.HP_Body_SetAngularVelocity(havokBody, [0, 0, 0]);

            // 4) If this body was asleep or deactivated, wake it up so the solver sees the change:
            HavokSystem.havok.HP_Body_SetActivationState(
              havokBody,
              HavokSystem.havok.ActivationState.ACTIVE
            );
          } else if (opts.prop == 'applyCentralForce') {
            HavokSystem.havok.HP_Body_ApplyImpulse(
              havokBody,
              [0, 0, 0], // apply at center of mass
              opts.value // [fx, fy, fz]
            );

            HavokSystem.havok.HP_Body_SetActivationState(
              havokBody,
              HavokSystem.havok.ActivationState.ACTIVE
            );

            // }else if (Reflect.has(body, opts.prop)){
            //     let fnArgs = getParamNames(Reflect.get(body, opts.prop));
            //     let fnValues = opts.value;
            //     // let fnValues = JSON.parse("[" + opts.value + "]");

            //     if (fnArgs.length != fnValues.length) throw(`[${opts.prop}] Wrong number of arguments, expected ${fnArgs.length} but received ${fnValues.length}`)

            //     let finalValues = [];

            //     for (var v of fnValues) {
            //         if (Array.isArray(v) && v.length == 3) finalValues.push(new Ammo.btVector3(...v))
            //         else finalValues.push(v);
            //     }

            //     body[opts.prop](...finalValues);

            //     // body[opts.prop].apply(null, finalValues)
          }
        }
      } catch (error) {
        console.log(error);
      }
    },
    getMotionState: () => {
      return physics_transformation;
    },
    updateVehicleControls,
  };

   Object.defineProperties(RB, {
        body: { get: () => { return havokBody; }, set: (v) => { } },
        wheels: { get: () => { return wheels; }, set: (v) => { } },
    })


    let Object3d = {}
    Object.defineProperties(Object3d, {
        rotate: { get: () => { return getProperty('object_rotate'); }, set: (v) => { setProperty('object_rotate', v, ""); } },
        onUpdate: { get: () => { return onUpdate; }, set: (v) => { onUpdate = v} },
    })

    // Props and Methods
    Object.defineProperties(object, {
        // orientation: { get: () => { return (Module.ProjectManager.projectRunning) ? world.orientation : 0; }, set: (v) => { world.orientation = v; } },
        mass: { get: () => { return getProperty('mass'); }, set: (v) => { setProperty('mass', v, "mass"); } },
        position: { get: () => { return getProperty('position'); }, set: (v) => { setProperty('position', v, "transform"); } },
        scale: { get: () => { return getProperty('scale'); }, set: (v) => { setProperty('scale', v, "transform"); } },
        rotate: { get: () => { return getProperty('rotate'); }, set: (v) => { setProperty('rotate', v, "transform"); } },
        shape_type: { get: () => { return getProperty('shape_type'); }, set: (v) => { setProperty('shape_type', v, "readd"); } },
        shape_file: { get: () => { return getProperty('shape_file'); }, set: (v) => { setProperty('shape_file', v, "readd"); } },
        ghost: { get: () => { return getProperty('ghost'); }, set: (v) => { setProperty('ghost', v, "ghost"); } },
        RigidBody: { get: () => { return RB; }, set: (v) => {} },
        RaycastVehicle: { get: () => { return vehicle; }, set: (v) => {} },
        object: { get: () => { return Object3d; }, set: (v) => {} },
        props: { get: () => { return propdata; }, set: (v) => { } },
        code: { get: () => { return getProperty('code')[1]; }, set: (v) => { setProperty('code', v); }, },
        controller: { get: () => { return getProperty('controller')[1]; }, set: (v) => { setProperty('controller', v); } },
    })
    
    Object.assign(object, {
        remove,
        render,
        update,
        addUpdateHandler,
        removeUpdateHandler,

        updateState
    })

    return object;
};
