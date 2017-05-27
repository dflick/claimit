contract('Insurer', function(accounts) {

    it("should be possible to add new insurer 'YP'", function () {
        var insurer = Insurer.deployed();
        return insurer.addInsurer.call("0x914d5475cc8df77055fb8f21d822b4b8663a6f13", "YP", { from: "0xb91250ea45e1b99258d56f96fdaf3fb5f64fbb5a" })
            .then( function (successfulArray1) {
                assert.isTrue(successfulArray1[0], "should be possible to add new insurer");
                return insurer.addInsurer("0x914d5475cc8df77055fb8f21d822b4b8663a6f13", "YP", { from: "0xb91250ea45e1b99258d56f96fdaf3fb5f64fbb5a" });
		});
    });

    it("should not be possible to add existing insurer again", function() {
        var insurer = Insurer.deployed();
        return insurer.addInsurer.call("0x914d5475cc8df77055fb8f21d822b4b8663a6f13", "YP", { from: "0xb91250ea45e1b99258d56f96fdaf3fb5f64fbb5a" })
            .then( function (successfulArray2) {
                assert.isNotTrue(successfulArray2[0], "YP should not be possible to insurer");
                return insurer.addInsurer("0x914d5475cc8df77055fb8f21d822b4b8663a6f13", "YP", { from: "0xb91250ea45e1b99258d56f96fdaf3fb5f64fbb5a" });
        });        
    });

    it("should not be possible to add regulator as insurer", function () {
        var insurer = Insurer.deployed();
        return insurer.addInsurer.call("0xb91250ea45e1b99258d56f96fdaf3fb5f64fbb5a", "YP", { from: "0xb91250ea45e1b99258d56f96fdaf3fb5f64fbb5a" })
            .then( function (successfulArray1) {
                assert.isNotTrue(successfulArray1[0], "regulator should not be able to be added as insurer");
                return insurer.addInsurer("0xb91250ea45e1b99258d56f96fdaf3fb5f64fbb5a", "YP", { from: "0xb91250ea45e1b99258d56f96fdaf3fb5f64fbb5a" });
        });
    });

    /* SHIT! NOT ABLE TO MAKE THIS WORK. DON'T KNOW HOW TO TEST THE SCEANRIO WHEN FUNCTION THROWS.
    it("should not be possible to add insurer if not Regulator", function() {
        var insurer = Insurer.deployed();
        return insurer.addInsurer.call("0x914d5475cc8df77055fb8f21d822b4b8663a6f13", "YP", { from: "0x914d5475cc8df77055fb8f21d822b4b8663a6f13" })
            .then( function (throwsShit) {
                assert.ifError(throwsShit, "should not be possible to insurer YP add Insurers");
                return insurer.addInsurer("0x914d5475cc8df77055fb8f21d822b4b8663a6f13", "YP", { from: "0x914d5475cc8df77055fb8f21d822b4b8663a6f13" });
        });        
    }); */

    it("should be possible to get insurer by id of YP as regulator", function() {
    	var insurer = Insurer.deployed();
    	return insurer.getInsurer.call(1, { from: "0xb91250ea45e1b99258d56f96fdaf3fb5f64fbb5a"})
    		.then( function(addressNameArray1) {
    			assert.equal(addressNameArray1[2], "YP", "should be possible to get insurer by id");
    			return insurer.getInsurer.call(1, { from: "0xb91250ea45e1b99258d56f96fdaf3fb5f64fbb5a"});
		});
    });

});