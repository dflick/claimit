contract('Insurance', function(accounts) {

    it("should be possible to add new insurance 'Home'", function () {
        var insurance = Insurance.deployed();
        return insurance.addInsurance.call("Home", "This is a Home insurance")
            .then( function (successful) {
                assert.isTrue(successful, "should be able to add insurance");
                return insurance.addInsurance("Home", "This is a Home insurance");
		});
    });

});