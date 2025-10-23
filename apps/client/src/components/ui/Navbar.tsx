import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const handleLogout = () => {
        // Clear user session / token here
        localStorage.removeItem("userToken"); // example
        navigate("/login"); // redirect to login page
    };

    return (
        <nav
            className="text-white shadow-md"
            style={{ backgroundColor: "hsl(222.86deg 84% 4.9%)" }}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    {/* Logo / Brand */}
                    <div className="flex-shrink-0">
                        <Link
                            to="/"
                            className="text-2xl font-bold tracking-wide hover:text-blue-300 transition-colors duration-200"
                        >
                            OpsiMate
                        </Link>
                    </div>

                    {/* Desktop Menu Links */}
                    <div className="hidden md:flex space-x-6">
                        <Link
                            to="/"
                            className="hover:text-blue-400 transition-colors duration-200"
                        >
                            Home
                        </Link>
                        <Link
                            to="/features"
                            className="hover:text-blue-400 transition-colors duration-200"
                        >
                            Features
                        </Link>
                        <Link
                            to="/integrations"
                            className="hover:text-blue-400 transition-colors duration-200"
                        >
                            Integrations
                        </Link>
                        <Link
                            to="/community"
                            className="hover:text-blue-400 transition-colors duration-200"
                        >
                            Community
                        </Link>

                        <Link
                            to="/contact"
                            className="hover:text-blue-400 transition-colors duration-200"
                        >
                            Contact
                        </Link>
                    </div>

                    {/* Desktop Logout */}
                    <div className="hidden md:flex">
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 rounded-md"
                            style={{ backgroundColor: "hsl(222.86deg 84% 9%)" }}
                        >
                            Logout
                        </button>
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden flex items-center">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="focus:outline-none"
                        >
                            <svg
                                className="h-6 w-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden px-4 pt-2 pb-4 space-y-2" style={{ backgroundColor: "hsl(222.86deg 84% 4.9%)" }}>
                    <Link
                        to="/"
                        onClick={() => setIsOpen(false)}
                        className="block hover:text-blue-400 transition-colors duration-200"
                    >
                        Home
                    </Link>
                    <Link
                        to="/features"
                        onClick={() => setIsOpen(false)}
                        className="block hover:text-blue-400 transition-colors duration-200"
                    >
                        Features
                    </Link>
                    <Link
                        to="/integrations"
                        onClick={() => setIsOpen(false)}
                        className="block hover:text-blue-400 transition-colors duration-200"
                    >
                        Integrations
                    </Link>
                    <Link
                        to="/community"
                        onClick={() => setIsOpen(false)}
                        className="block hover:text-blue-400 transition-colors duration-200"
                    >
                        Community
                    </Link>

                    <Link
                        to="/contact"
                        onClick={() => setIsOpen(false)}
                        className="block hover:text-blue-400 transition-colors duration-200"
                    >
                        Contact
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 rounded-md mt-2"
                        style={{ backgroundColor: "hsl(222.86deg 84% 9%)" }}
                    >
                        Logout
                    </button>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
