---
title: "A 3-DOF delta robot, designed and built from scratch"
summary: "My final-year mechanical engineering project at IIT (ISM) Dhanbad: a parallel pick-and-place robot with its kinematics, motion profile, vision and control written by hand, and the first build out of the department's new Robotics and Automation Lab."
company: "IIT (ISM) Dhanbad"
role: "Team lead, final-year project"
timeline: "2021 to 2022"
metrics:
  - { value: "3 tasks", label: "On film: trace a circle, pick a KitKat, pick a coloured disc" }
  - { value: "1 mm", label: "Repeatability the links and servos were sized for" }
  - { value: "First", label: "Build from the new Robotics and Automation Lab" }
tags: ["Robotics", "Kinematics", "Computer vision", "Mechanical design", "Embedded control"]
order: 20
featured: false
draft: false
kind: academic
scene: night
photo: "/photos/night-machapuchare.webp"
focal: center
films:
  - id: "C00poCvbEdg"
    title: "Delta Robot in Action"
    by: "Mamoon Mondal"
    duration: "1:36"
    poster: "/shots/delta-robot/film-action.webp"
    caption: "The three demonstration tasks, filmed in the lab in June 2022."
  - id: "sh7DGhhTZwA"
    title: "Delta Robot in Making"
    by: "Arun Dayal Udai, supervisor"
    duration: "3:48"
    poster: "/shots/delta-robot/film-making.webp"
    caption: "The overnight assembly, filmed by our supervisor in November 2021."
galleryTitle: "Stills"
gallery:
  - src: "/shots/delta-robot/01-cad.webp"
    alt: "A SolidWorks rendering of the delta robot: a blue base plate, three red motor arms, thin parallelogram rods and a small triangular platform"
    caption: "The SolidWorks assembly: base plate, three motor arms, the parallelogram links and the platform."
  - src: "/shots/delta-robot/02-tracing.webp"
    alt: "The delta robot inside an aluminium frame, its platform moving over a white table, a screen beside it showing a terminal"
    caption: "Task one. The platform traces a circular contour above the table, one inverse kinematics solve per point."
  - src: "/shots/delta-robot/03-vision.webp"
    alt: "Two camera windows on a Raspberry Pi desktop, both showing a red disc on a white table from above"
    caption: "The camera view and the frame rotated into the robot's axes, with the red disc found by HSV thresholding."
  - src: "/shots/delta-robot/04-trajectory.webp"
    alt: "A terminal window listing detected pixel coordinates, a matrix of waypoints in metres, and lines reading generating trajectory between points"
    caption: "The controller's terminal: the detected centre, the waypoints in metres, and each trajectory generated between them."
  - src: "/shots/delta-robot/05-kitkat.webp"
    alt: "The delta robot holding a red KitKat bar under its suction gripper, above the table"
    caption: "Task two. The suction gripper carries a KitKat bar to the drop point."
links:
  - { label: "Source on GitHub", href: "https://github.com/atmamoon/Delta-Robot" }
  - { label: "The film on YouTube", href: "https://www.youtube.com/watch?v=C00poCvbEdg" }
---

## Context

A delta robot is a parallel robot. Three motors on a fixed base each drive an arm,
and the three arms meet at a small moving platform through parallelogram linkages.
The parallelograms keep the platform level, so it moves in x, y and z and never
tilts, which is why this layout runs pick-and-place lines in packaging and
electronics. For my final-year project in mechanical engineering at IIT (ISM)
Dhanbad I led a team of three that designed one, machined and printed its parts,
wired it, and wrote the software that moves it, supervised by Dr. Arun Dayal Udai.
It was the first undergraduate build to come out of the department's newly
established Robotics and Automation Lab.

## The problem

The brief was an industrial-style delta robot that the lab could keep using after
we graduated: a repeatability target of 1 mm, the whole machine inside a 400 by
400 by 500 mm volume, and a pick-and-place demonstration driven by a camera rather
than by coordinates typed in by hand. There was no kit. The link lengths set both
the workspace and the precision, the parts had to be made on the machines we had,
the three motors had to move in step, and the software had to turn a camera image
into a path the platform could follow without stalling a servo or driving the
platform into the table.

## Approach

**Size the links before drawing anything.** The reach of a delta robot is the sum
of its upper arm and its parallelogram link, but the usable workspace and the
precision come from the ratio between them. We fixed the geometry at a 160 mm upper
arm and a 225 mm parallelogram link, on a base 130 mm from centre to side with a
37.64 mm platform, and checked it against the repeatability target the direct way:
run a coordinate through inverse kinematics, quantise the angles to the servo's
steps, run forward kinematics back, and measure how far the platform has moved.

**Design for the machines we had.** The base plate, the motor couplers and the
platform were modelled in SolidWorks 2021 and made by CNC machining and 3D
printing, with the parallelogram links built from rod ends on rods. Stress analysis
in Ansys checked the load-bearing parts. The frame is aluminium extrusion, so the
camera, the controller and the work surface bolt to the same structure as the
robot.

**Solve the kinematics in closed form.** Each arm's inverse kinematics reduces to a
quadratic in the tangent of the half angle, so the three motor angles for any
target come from three root solves with no iteration. The solution nearest
horizontal is kept, and a depth guard refuses any target that would take all three
arms past the platform's lowest safe position.

**Shape the motion, not just the endpoints.** Every segment between waypoints
follows a modified sine profile, sampled at 4,000 points and passed through inverse
kinematics point by point, with the segment time set from the distance and a chosen
maximum acceleration. The profile was chosen because its acceleration is
continuous, so the platform is never asked to change speed instantly. The three
Dynamixel AX-series servos take each set of angles in one synchronous write over a
2 Mbps bus, so the arms move together.

**Let the camera pick the target.** A USB camera above the table takes a frame,
which is rotated into the robot's axes, thresholded in HSV for the object's colour,
and reduced to the centroid of the largest contour. A linear map calibrated from two
known distances on the table converts that pixel into millimetres, and the
controller builds the waypoints itself: home, above the object, down to the object,
up again, across to the drop point, release, home. A suction gripper switched by a
Raspberry Pi GPIO pin closes at the pick and opens at the drop.

## What the robot does

The first film above shows the three tasks we demonstrated: tracing a circular
contour, picking up a KitKat bar and placing it at a fixed point, and picking up a
coloured disc wherever it has been left on the table. Everything runs on a
Raspberry Pi mounted in the frame, from the camera to the servo bus, and the
terminal on the screen prints the detected centre, the computed coordinates and
each trajectory as it is generated. The second film is our supervisor's timelapse
of the overnight assembly in the lab.

We also costed an industrial-scale version, with brushless servomotors on 10:1
planetary gearboxes, a 524 mm upper arm and a 1,244 mm parallelogram link, and
kept the same kinematics code for it.

## Reflection & tradeoffs

- **The geometry decided the precision, not the code.** A 300 degree servo with
  1,024 positions moves about 0.3 degrees per step, and at the end of the 160 mm
  arm alone that step is about 0.8 mm. Sizing the links against that limit before
  any code existed is what made the repeatability target reachable at all.
- **Motion profiles mattered more than speed.** The servos could move faster than we
  ever ran them. The work that made the pick repeatable went into how a move starts
  and stops, not into how fast it goes.
- **Calibration is a product decision.** The pixel to millimetre map was measured by
  hand from two distances on the table, which makes it the most fragile part of the
  system: it depends on the camera staying exactly where it was when those distances
  were measured. A fixture that holds the camera at a fixed pose is worth more than
  a better detector.
- **What I would build next:** position feedback from the platform rather than from
  the motors, so the repeatability is measured instead of derived, and a
  checkerboard camera calibration in place of the two-distance map.
