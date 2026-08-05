//! 4-point homography (Direct Linear Transform)

use nalgebra::{DMatrix, DVector};

#[derive(Clone, Copy, Debug)]
pub struct Point {
    pub x: f32,
    pub y: f32,
}

pub fn compute_homography(src: &[Point; 4], dst: &[Point; 4]) -> Option<[f32; 9]> {
    // Build 8x8 system
    let mut a = DMatrix::<f64>::zeros(8, 8);
    let mut b = DVector::<f64>::zeros(8);

    for i in 0..4 {
        let sx = src[i].x as f64;
        let sy = src[i].y as f64;
        let dx = dst[i].x as f64;
        let dy = dst[i].y as f64;

        // First row
        a[(i * 2, 0)] = sx;
        a[(i * 2, 1)] = sy;
        a[(i * 2, 2)] = 1.0;
        a[(i * 2, 6)] = -sx * dx;
        a[(i * 2, 7)] = -sy * dx;
        b[i * 2] = dx;

        // Second row
        a[(i * 2 + 1, 3)] = sx;
        a[(i * 2 + 1, 4)] = sy;
        a[(i * 2 + 1, 5)] = 1.0;
        a[(i * 2 + 1, 6)] = -sx * dy;
        a[(i * 2 + 1, 7)] = -sy * dy;
        b[i * 2 + 1] = dy;
    }

    // Solve using nalgebra
    match a.lu().solve(&b) {
        Some(h) => {
            let mut result = [0f32; 9];
            for i in 0..8 {
                result[i] = h[i] as f32;
            }
            result[8] = 1.0;
            Some(result)
        }
        None => None,
    }
}

pub fn apply_homography(h: &[f32; 9], x: f32, y: f32) -> Point {
    let w = h[6] * x + h[7] * y + h[8];
    if w.abs() < 1e-6 {
        return Point { x: 0.0, y: 0.0 };
    }
    Point {
        x: (h[0] * x + h[1] * y + h[2]) / w,
        y: (h[3] * x + h[4] * y + h[5]) / w,
    }
}

/// Order 4 points into TL, TR, BR, BL
pub fn order_corners(mut pts: Vec<Point>) -> [Point; 4] {
    if pts.len() != 4 {
        return [Point { x: 0.0, y: 0.0 }; 4];
    }

    pts.sort_by(|a, b| (a.x + a.y).partial_cmp(&(b.x + b.y)).unwrap());
    let tl = pts[0];
    let br = pts[3];

    let mut remaining: Vec<_> = pts[1..3].to_vec();
    remaining.sort_by(|a, b| (a.x - a.y).partial_cmp(&(b.x - b.y)).unwrap());

    let tr = remaining[0];
    let bl = remaining[1];

    [tl, tr, br, bl]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_homography_identity() {
        let src = [
            Point { x: 0.0, y: 0.0 },
            Point { x: 100.0, y: 0.0 },
            Point { x: 100.0, y: 100.0 },
            Point { x: 0.0, y: 100.0 },
        ];
        let dst = src.clone();

        if let Some(h) = compute_homography(&src, &dst) {
            let p = apply_homography(&h, 50.0, 50.0);
            assert!((p.x - 50.0).abs() < 0.1);
            assert!((p.y - 50.0).abs() < 0.1);
        }
    }
}
