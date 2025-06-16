![gophishusb logo](https://raw.githubusercontent.com/niklasent/gophishusb/master/static/images/gophishusb_purple.png)

GophishUSB
=======

GophishUSB - An USB Phishing Framework based on Gophish 

GophishUSB is a modification of the open-source phishing toolkit [Gophish](https://getgophish.com) designed for businesses and penetration testers. It provides the ability to setup and execute USB phishing engagements and security awareness training.  

### How it works

The functionality and design of GophishUSB is similar to the classic Gophish.
However, GophishUSB is designed to simulate USB phishing attacks by using dedicated USB devices as well as Windows agents for the target machines.  

Each USB device utilized for phishing needs to be prepared using the [GophishUSB Preparation Tool](https://github.com/niklasent/gophishusb-prep). The preparation tool also registers the USB device to the GophishUSB instance. Unregistered devices are not invalid for phishing events.

Moreover, the phishing detection is agent-basded, meaning that the [GophishUSB Windows Agent](https://github.com/niklasent/gophishusb-agent) needs to be installed on every target machine. Please note that macOS and Linux targets are not supported yet.
The Windows agent periodically scans each mounted USB device for flag files indicating a successful phishing attack. If a flag file is found, a phishing event is posted to the GophishUSB instance managing the phishing campaigns.

![gophishusb process](https://raw.githubusercontent.com/niklasent/gophishusb/master/static/images/gophishusb-process.png)

### Building From Source
**If you are building from source, please note that GophishUSB requires Go v1.10 or above!**

To build GophishUSB from source, simply run ```git clone https://github.com/niklasent/gophishusb.git``` and ```cd``` into the project source directory. Then, run ```go build```. After this, you should have a binary called ```gophishusb``` in the current directory.

### Setup
After running the GophishUSB binary, open an Internet browser to https://localhost:3333 and login with the default username and password listed in the log output.
e.g.
```
time="2020-07-29T01:24:08Z" level=info msg="Please login with the username admin and the password 4304d5255378177d"
```

### Issues

Find a bug? Want more features? Find something missing in the documentation? Let us know! Please don't hesitate to [file an issue](https://github.com/niklasent/gophishusb/issues/new) and we'll get right on it.

### License
```
GophishUSB - An USB Phishing Framework based on Gophish

The MIT License (MIT)

Copyright (c) 2013-2020 Jordan Wright
Copyright (c) 2025 Niklas Entschladen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software ("GophishUSB") and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
