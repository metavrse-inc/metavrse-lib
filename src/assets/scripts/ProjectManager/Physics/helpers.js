var quaternionToEuler = (q, rot) => {
    var x = q[0],
        y = q[1],
        z = q[2],
        w = q[3];
    let t0 = +2.0 * (w * x + y * z)
    let t1 = +1.0 - 2.0 * (x * x + y * y)
    let roll_x = Math.atan2(t0, t1)

    let t2 = +2.0 * (w * y - z * x)
    if (t2 > 1) t2 = 1;
    else if (t2 < -1) t2 = -1

    let pitch_y = Math.asin(t2)

    let t3 = +2.0 * (w * z + x * y)
    let t4 = +1.0 - 2.0 * (y * y + z * z)
    let yaw_z = Math.atan2(t3, t4)

    let xyz = [roll_x * (180 / Math.PI), pitch_y * (180 / Math.PI), yaw_z * (180 / Math.PI)]

    if (isNaN(xyz[0]) || isNaN(xyz[1]) || isNaN(xyz[2])) {
        // console.log(xyz, rot)
        return [...rot]
    }
    return xyz;
};

module.exports = {
    quaternionToEuler
}