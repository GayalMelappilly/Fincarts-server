export const signUpUser = async(req, res) => {
    const user = req.body
    console.log('phone number : ', user)

   res.status(201).json({
    success: true,
    data: user
   })
}