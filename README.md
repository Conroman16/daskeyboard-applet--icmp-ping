# DasKeyboard ICMP Ping
A DasKeyboard applet for displaying ICMP ping response time as a color gradient depending on speed.

### This applet is very much a work in progress
I've only put a couple hours of work into it at this point.  It's utilizing the OS's `ping` command, so there's a windows compatibility issue here until I write in an OS check so I can send the right args to the `ping` command.  Right now it only supports ping commands that suport `-c` to specify a number of pings, which should be pretty much all \*nix/BSD
