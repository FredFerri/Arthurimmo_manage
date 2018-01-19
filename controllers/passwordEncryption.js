const saltRounds = 10;
const password = 'arthur_visit21';

bcrypt.genSalt(saltRounds, function(err, salt) {
    bcrypt.hash(password, salt, function(err, hash) {
        console.log(hash);
    });
});