#ifndef POINT_H
#define POINT_H

#include <cmath>
#include <vector>

/**
 * Point structure for 2D coordinates
 */
struct Point {
    double x;
    double y;

    Point() : x(0), y(0) {}
    Point(double x_, double y_) : x(x_), y(y_) {}

    bool operator==(const Point& other) const {
        return std::abs(x - other.x) < 1e-9 && std::abs(y - other.y) < 1e-9;
    }

    bool operator!=(const Point& other) const {
        return !(*this == other);
    }

    double distanceTo(const Point& other) const {
        double dx = x - other.x;
        double dy = y - other.y;
        return std::sqrt(dx * dx + dy * dy);
    }
};

/**
 * Line structure representing a line segment
 */
struct Line {
    Point p1;
    Point p2;
    int featureIndex; // Index of the feature this line belongs to
    
    Line() : featureIndex(-1) {}
    Line(const Point& a, const Point& b, int idx = -1) 
        : p1(a), p2(b), featureIndex(idx) {}

    double length() const {
        return p1.distanceTo(p2);
    }

    // Calculate direction vector
    Point direction() const {
        return Point(p2.x - p1.x, p2.y - p1.y);
    }
};

#endif // POINT_H
